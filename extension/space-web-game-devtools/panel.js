const pollIntervalMs = 500
const commandLogLimit = 24

const elements = {
    appMode: document.querySelector('#appMode'),
    assistMode: document.querySelector('#assistMode'),
    assistTarget: document.querySelector('#assistTarget'),
    bodyList: document.querySelector('#bodyList'),
    cameraMode: document.querySelector('#cameraMode'),
    cameraPan: document.querySelector('#cameraPan'),
    coastHorizon: document.querySelector('#coastHorizon'),
    closeRawSnapshotButton: document.querySelector('#closeRawSnapshotButton'),
    commandLog: document.querySelector('#commandLog'),
    connectionHint: document.querySelector('#connectionHint'),
    copyRawSnapshotButton: document.querySelector('#copyRawSnapshotButton'),
    crashState: document.querySelector('#crashState'),
    debugSnapshotStatus: document.querySelector('#debugSnapshotStatus'),
    elapsed: document.querySelector('#elapsed'),
    openRawSnapshotButton: document.querySelector('#openRawSnapshotButton'),
    rawJson: document.querySelector('#rawJson'),
    rawJsonFull: document.querySelector('#rawJsonFull'),
    rawSnapshotPanel: document.querySelector('#rawSnapshotPanel'),
    refreshButton: document.querySelector('#refreshButton'),
    scenarioCheckpoint: document.querySelector('#scenarioCheckpoint'),
    scenarioCompleted: document.querySelector('#scenarioCompleted'),
    scenarioId: document.querySelector('#scenarioId'),
    scenarioPrompt: document.querySelector('#scenarioPrompt'),
    scenarioTitle: document.querySelector('#scenarioTitle'),
    spacecraftFuel: document.querySelector('#spacecraftFuel'),
    spacecraftHeading: document.querySelector('#spacecraftHeading'),
    spacecraftPosition: document.querySelector('#spacecraftPosition'),
    spacecraftSpeed: document.querySelector('#spacecraftSpeed'),
    spacecraftVelocity: document.querySelector('#spacecraftVelocity'),
    status: document.querySelector('#status'),
    targetHeading: document.querySelector('#targetHeading'),
    timeWarp: document.querySelector('#timeWarp'),
    timeWarpSelect: document.querySelector('#timeWarpSelect'),
    viewportSize: document.querySelector('#viewportSize'),
}

const formatNumber = (value, digits = 2) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—'
    }

    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: digits,
    }).format(value)
}

const formatVec = (vector, digits = 1) =>
    vector ? `${formatNumber(vector.x, digits)}, ${formatNumber(vector.y, digits)}` : '—'

const formatBool = (value) => (value ? 'yes' : 'no')
const formatSeconds = (seconds) => `${formatNumber(seconds, 1)} s`
let latestRawSnapshotJson = '{}'

const escapeHtml = (value) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const highlightJson = (json) =>
    escapeHtml(json).replace(
        /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
        (token) => {
            let tokenClass = 'json-number'

            if (token.startsWith('"')) {
                tokenClass = /:\s*$/.test(token) ? 'json-key' : 'json-string'
            } else if (token === 'true' || token === 'false') {
                tokenClass = 'json-boolean'
            } else if (token === 'null') {
                tokenClass = 'json-null'
            }

            return `<span class="${tokenClass}">${token}</span>`
        },
    )

const renderRawSnapshot = (snapshot) => {
    latestRawSnapshotJson = JSON.stringify(snapshot, null, 2)
    const highlightedJson = highlightJson(latestRawSnapshotJson)
    elements.rawJson.innerHTML = highlightedJson
    elements.rawJsonFull.innerHTML = highlightedJson
}

const getBridgeExpression = (request) => {
    const requestLiteral = JSON.stringify(request).replaceAll('<', '\\u003c')

    return `(() => {
    const bridge = window.__SPACE_WEB_GAME_DEVTOOLS__;
    if (!bridge) {
      return { ok: false, error: 'Space Web Game devtools bridge not found' };
    }
    return bridge.handleRequest(${requestLiteral});
  })()`
}

const evalInInspectedPage = (expression) =>
    new Promise((resolve, reject) => {
        chrome.devtools.inspectedWindow.eval(
            expression,
            { useContentScriptContext: false },
            (result, exceptionInfo) => {
                if (exceptionInfo) {
                    reject(new Error(exceptionInfo.description || exceptionInfo.value || 'Eval failed'))
                    return
                }

                resolve(result)
            },
        )
    })

const sendBridgeRequest = async (request) => {
    const response = await evalInInspectedPage(getBridgeExpression(request))

    if (!response || response.ok !== true) {
        throw new Error(response?.error || 'Bridge request failed')
    }

    return response
}

const setConnected = (connected, message) => {
    elements.status.textContent = connected ? 'Connected' : 'Disconnected'
    elements.status.classList.toggle('connected', connected)
    elements.status.classList.toggle('disconnected', !connected)
    elements.connectionHint.classList.toggle('hidden', connected)

    if (!connected && message) {
        elements.connectionHint.textContent = `${message}. Run the app in local dev mode, or open a deployed build with ?devtools=1.`
    }
}

const appendCommandLog = (label, detail, ok = true) => {
    const entry = document.createElement('li')
    const title = document.createElement('strong')
    title.textContent = ok ? label : `Failed: ${label}`
    entry.append(title)

    if (detail) {
        entry.append(` — ${detail}`)
    }

    elements.commandLog.prepend(entry)

    while (elements.commandLog.children.length > commandLogLimit) {
        elements.commandLog.lastElementChild.remove()
    }
}

const renderTimeWarpSelect = (snapshot) => {
    const currentIndex = snapshot.simulation.timeWarpIndex
    const options = snapshot.simulation.timeWarps.map((warp, index) => {
        const option = document.createElement('option')
        option.value = String(index)
        option.textContent = `${index}: ${warp}×`
        option.selected = index === currentIndex
        return option
    })

    elements.timeWarpSelect.replaceChildren(...options)
}

const renderDebugFlags = (snapshot) => {
    document.querySelectorAll('[data-debug-flag]').forEach((input) => {
        input.checked = Boolean(snapshot.debug[input.dataset.debugFlag])
    })
    elements.debugSnapshotStatus.textContent = snapshot.debug.debugSnapshotStatus || 'No debug snapshot status'
}

const renderBodies = (snapshot) => {
    const items = snapshot.simulation.bodies.map((body) => {
        const item = document.createElement('div')
        item.className = 'body-item'

        const title = document.createElement('div')
        title.className = 'body-title'

        const color = document.createElement('span')
        color.className = 'body-color'
        color.style.backgroundColor = body.color

        const name = document.createElement('span')
        name.textContent = `${body.name} (${body.id})`

        const position = document.createElement('span')
        position.textContent = `pos ${formatVec(body.position)} · speed ${formatNumber(body.speed, 2)}`

        title.append(color, name)
        item.append(title, position)
        return item
    })

    elements.bodyList.replaceChildren(...items)
}

const renderSnapshot = (snapshot) => {
    const prompt = snapshot.scenario.promptUi.activePromptId || snapshot.scenario.promptUi.replayPromptId || 'none'
    const spacecraft = snapshot.simulation.spacecraft

    elements.appMode.textContent = snapshot.appMode
    elements.scenarioTitle.textContent = snapshot.scenario.title
    elements.scenarioId.textContent = snapshot.scenario.scenarioId
    elements.scenarioCompleted.textContent = formatBool(snapshot.scenario.completed)
    elements.scenarioCheckpoint.textContent = formatBool(snapshot.scenario.hasCheckpoint)
    elements.scenarioPrompt.textContent = prompt

    elements.elapsed.textContent = formatSeconds(snapshot.simulation.elapsed)
    elements.timeWarp.textContent = `${snapshot.simulation.timeWarp}× (index ${snapshot.simulation.timeWarpIndex})`
    elements.assistMode.textContent = snapshot.simulation.assistMode
    elements.assistTarget.textContent = snapshot.simulation.assistTarget?.name || 'none'
    elements.crashState.textContent = snapshot.simulation.crashedBodyName || 'clear'
    elements.coastHorizon.textContent = `${formatNumber(snapshot.simulation.coastPredictionHorizonHours, 2)} h`

    elements.spacecraftPosition.textContent = formatVec(spacecraft.position)
    elements.spacecraftVelocity.textContent = formatVec(spacecraft.velocity, 3)
    elements.spacecraftSpeed.textContent = formatNumber(spacecraft.speed, 3)
    elements.spacecraftHeading.textContent = formatNumber(spacecraft.heading, 4)
    elements.spacecraftFuel.textContent = `${formatNumber(spacecraft.fuel, 2)} / ${formatNumber(spacecraft.fuelCapacity, 2)}`

    elements.cameraMode.textContent = snapshot.camera.mode
    elements.viewportSize.textContent = formatNumber(snapshot.simulation.viewportSize, 1)
    elements.cameraPan.textContent = formatVec(snapshot.camera.panOffset)
    elements.targetHeading.textContent = snapshot.simulation.targetHeading === null ? 'none' : formatNumber(snapshot.simulation.targetHeading, 4)

    renderTimeWarpSelect(snapshot)
    renderDebugFlags(snapshot)
    renderBodies(snapshot)

    renderRawSnapshot(snapshot)
}

const refreshSnapshot = async () => {
    try {
        const response = await sendBridgeRequest({ type: 'get-snapshot' })
        setConnected(true)
        renderSnapshot(response.snapshot)
        return response.snapshot
    } catch (error) {
        setConnected(false, error.message)
        return null
    }
}

const runCommand = async (label, request) => {
    try {
        const response = await sendBridgeRequest(request)
        setConnected(true)
        renderSnapshot(response.snapshot)
        appendCommandLog(label, response.message || 'ok')
    } catch (error) {
        appendCommandLog(label, error.message, false)
        setConnected(false, error.message)
    }
}

const openRawSnapshotPanel = () => {
    elements.rawSnapshotPanel.classList.remove('hidden')
    elements.rawSnapshotPanel.setAttribute('aria-hidden', 'false')
    elements.rawJsonFull.focus()
}

const closeRawSnapshotPanel = () => {
    elements.rawSnapshotPanel.classList.add('hidden')
    elements.rawSnapshotPanel.setAttribute('aria-hidden', 'true')
    elements.openRawSnapshotButton.focus()
}

const copyText = async (text) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
}

const copyRawSnapshot = async () => {
    try {
        await copyText(latestRawSnapshotJson)
        appendCommandLog('Copy raw snapshot', 'copied JSON to clipboard')
    } catch (error) {
        appendCommandLog('Copy raw snapshot', error.message, false)
    }
}

document.addEventListener('click', (event) => {
    const uiActionButton = event.target.closest('[data-ui-action]')
    if (uiActionButton) {
        runCommand(uiActionButton.textContent.trim(), {
            action: uiActionButton.dataset.uiAction,
            type: 'dispatch-ui-action',
        })
        return
    }

    const commandButton = event.target.closest('[data-command]')
    if (!commandButton) {
        return
    }

    if (commandButton.dataset.command === 'camera:centered') {
        runCommand('Camera centered', { mode: 'centered', type: 'set-camera-mode' })
    }

    if (commandButton.dataset.command === 'camera:unlocked') {
        runCommand('Camera unlocked', { mode: 'unlocked', type: 'set-camera-mode' })
    }
})

document.addEventListener('change', (event) => {
    const debugInput = event.target.closest('[data-debug-flag]')
    if (debugInput) {
        runCommand(debugInput.parentElement.textContent.trim(), {
            flag: debugInput.dataset.debugFlag,
            type: 'set-debug-flag',
            value: debugInput.checked,
        })
        return
    }

    if (event.target === elements.timeWarpSelect) {
        runCommand('Set time warp', {
            index: Number(elements.timeWarpSelect.value),
            type: 'set-time-warp-index',
        })
    }
})

elements.refreshButton.addEventListener('click', () => {
    refreshSnapshot()
})

elements.openRawSnapshotButton.addEventListener('click', () => {
    openRawSnapshotPanel()
})

elements.closeRawSnapshotButton.addEventListener('click', () => {
    closeRawSnapshotPanel()
})

elements.copyRawSnapshotButton.addEventListener('click', () => {
    copyRawSnapshot()
})

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.rawSnapshotPanel.classList.contains('hidden')) {
        closeRawSnapshotPanel()
    }
})

refreshSnapshot()
setInterval(refreshSnapshot, pollIntervalMs)
