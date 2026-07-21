const pollIntervalMs = 500
const commandLogLimit = 24
const reuseHistoryLimit = 24
const devtoolsVersionFileName = 'space-web-game-devtools-version.json'

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
    farCoalescingApplyButton: document.querySelector('#farCoalescingApplyButton'),
    farCoalescingOverrideEnabled: document.querySelector('#farCoalescingOverrideEnabled'),
    farCoalescingOverrideSeconds: document.querySelector('#farCoalescingOverrideSeconds'),
    openRawSnapshotButton: document.querySelector('#openRawSnapshotButton'),
    predictionEventSummary: document.querySelector('#predictionEventSummary'),
    predictionFarCalculation: document.querySelector('#predictionFarCalculation'),
    predictionFarCoalescing: document.querySelector('#predictionFarCoalescing'),
    predictionFarReuse: document.querySelector('#predictionFarReuse'),
    predictionFarReuseHistory: document.querySelector('#predictionFarReuseHistory'),
    predictionGeometryDuration: document.querySelector('#predictionGeometryDuration'),
    predictionInputKeys: document.querySelector('#predictionInputKeys'),
    predictionIntegrationStats: document.querySelector('#predictionIntegrationStats'),
    predictionIntegrationStep: document.querySelector('#predictionIntegrationStep'),
    predictionNearCalculation: document.querySelector('#predictionNearCalculation'),
    predictionNearTravel: document.querySelector('#predictionNearTravel'),
    predictionPointCounts: document.querySelector('#predictionPointCounts'),
    predictionRefreshInterval: document.querySelector('#predictionRefreshInterval'),
    predictionRefreshSummary: document.querySelector('#predictionRefreshSummary'),
    predictionSampleStep: document.querySelector('#predictionSampleStep'),
    predictionTargetSteps: document.querySelector('#predictionTargetSteps'),
    predictionTierState: document.querySelector('#predictionTierState'),
    rawJson: document.querySelector('#rawJson'),
    rawJsonFull: document.querySelector('#rawJsonFull'),
    rawSnapshotPanel: document.querySelector('#rawSnapshotPanel'),
    recentDebugSnapshotList: document.querySelector('#recentDebugSnapshotList'),
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
    versionStatus: document.querySelector('#versionStatus'),
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
const formatMs = (milliseconds) =>
    typeof milliseconds === 'number' && Number.isFinite(milliseconds)
        ? `${formatNumber(milliseconds, 1)} ms`
        : '—'
const formatSeconds = (seconds) => `${formatNumber(seconds, 1)} s`
const formatDistance = (meters) => {
    if (typeof meters !== 'number' || !Number.isFinite(meters)) {
        return '—'
    }

    if (Math.abs(meters) >= 1_000_000_000) {
        return `${formatNumber(meters / 1_000_000_000, 2)} Gm`
    }
    if (Math.abs(meters) >= 1_000_000) {
        return `${formatNumber(meters / 1_000_000, 2)} Mm`
    }
    if (Math.abs(meters) >= 1_000) {
        return `${formatNumber(meters / 1_000, 1)} km`
    }
    return `${formatNumber(meters, 0)} m`
}
const formatPercent = (ratio) =>
    typeof ratio === 'number' && Number.isFinite(ratio)
        ? `${formatNumber(ratio * 100, 1)}%`
        : '—'
const formatAge = (seconds) =>
    typeof seconds === 'number' && Number.isFinite(seconds)
        ? `${formatNumber(seconds, 1)} s ago`
        : '—'
const formatCompactAge = (seconds) =>
    typeof seconds === 'number' && Number.isFinite(seconds)
        ? `${formatNumber(seconds, 1)}s ago`
        : '—'
const formatCompactMs = (milliseconds) =>
    typeof milliseconds === 'number' && Number.isFinite(milliseconds)
        ? `${formatNumber(milliseconds, 1)}ms`
        : '—'
const formatRate = (count, seconds) => `${formatNumber(count / seconds, 1)}/s`
const emptyCalculationWindows = {
    averageLastSecondMs: null,
    averageLastTenSecondsMs: null,
    averageLastThirtySecondsMs: null,
    countLastSecond: 0,
    countLastTenSeconds: 0,
    countLastThirtySeconds: 0,
}
const formatCalculationTiming = (lastMs, ageSeconds, windows = emptyCalculationWindows) =>
    `last: ${formatMs(lastMs)} · ${formatCompactAge(ageSeconds)}
runs: 1s/10s/30s
      ${formatRate(windows.countLastSecond, 1)} | ${formatRate(windows.countLastTenSeconds, 10)} | ${formatRate(windows.countLastThirtySeconds, 30)}
avg:  ${formatCompactMs(windows.averageLastSecondMs)}/${formatCompactMs(windows.averageLastTenSecondsMs)}/${formatCompactMs(windows.averageLastThirtySecondsMs)}`
const formatIntegrationTier = (label, integration) =>
    `${label}: steps ${formatNumber(integration?.stepCount ?? null, 0)} · avg dt ${formatSeconds(integration?.averageStepSeconds)} · min dt ${formatSeconds(integration?.minStepSeconds)}`
const formatIntegrationStats = (integrationTiers) =>
    [
        formatIntegrationTier('near', integrationTiers?.near),
        formatIntegrationTier('far ', integrationTiers?.far),
    ].join('\n')
const formatNearTravel = (travel) =>
    `step:       ${formatDistance(travel?.lastStepDistanceMeters)} (${formatPercent(travel?.lastStepHorizonRatio)})
calc gap:   ${formatDistance(travel?.lastCalculationGapMeters)} (${formatPercent(travel?.lastCalculationGapRatio)})
near span:  ${formatDistance(travel?.horizonDistanceMeters)}`
const formatOptionalSeconds = (seconds) =>
    typeof seconds === 'number' && Number.isFinite(seconds) ? formatSeconds(seconds) : 'off'
const formatFarCoalescing = (prediction) =>
    [
        `min ${formatSeconds(prediction.farCoalescingMinIntervalSeconds ?? 0)}`,
        `override ${formatOptionalSeconds(prediction.farCoalescingMinIntervalOverrideSeconds)}`,
        `skipped ${formatNumber(prediction.farCoalescingSkippedCount ?? 0, 0)}`,
        prediction.farCoalescingLastSkipReason
            ? `last ${prediction.farCoalescingLastSkipStage || '—'}:${prediction.farCoalescingLastSkipReason}`
            : null,
    ]
        .filter(Boolean)
        .join(' · ')
const formatDivergenceValue = (value, unit) => {
    if (unit === 'meters') {
        return formatDistance(value)
    }
    if (unit === 'meters-per-second') {
        return `${formatNumber(value, 3)} m/s`
    }
    if (unit === 'seconds') {
        return `${formatNumber(value, 6)} s`
    }
    if (unit === 'count') {
        return formatNumber(value, 0)
    }
    return formatNumber(value, 6)
}
const formatDivergence = (divergence) => {
    if (!divergence) {
        return null
    }

    const measurements = (divergence.measurements ?? []).map((measurement) => {
        const body = measurement.bodyId ? ` ${measurement.bodyId}` : ''
        const diagnosticOnly = measurement.gatesReuse === false ? ' (info)' : ''
        return `${measurement.metric}${body}${diagnosticOnly} Δ ${formatDivergenceValue(measurement.delta, measurement.unit)} / limit ${formatDivergenceValue(measurement.tolerance, measurement.unit)}`
    })
    return [
        divergence.reason,
        divergence.detail ? `detail ${divergence.detail}` : null,
        ...measurements,
    ]
        .filter(Boolean)
        .join(' · ')
}
const formatReuseDetails = (reuse) => {
    if (reuse.mode === 'trim-extend') {
        const previousPointCount = reuse.trimmedPointCount + reuse.retainedPointCount
        const currentPointCount = reuse.retainedPointCount + reuse.extendedPointCount
        const previousSeconds = reuse.trimmedSeconds + reuse.retainedSeconds
        const currentSeconds = reuse.retainedSeconds + reuse.extendedSeconds
        const oldPointShares = `${formatPercent(reuse.trimmedPointCount / previousPointCount)}/${formatPercent(reuse.retainedPointCount / previousPointCount)}`
        const oldTimeShares = `${formatPercent(reuse.trimmedSeconds / previousSeconds)}/${formatPercent(reuse.retainedSeconds / previousSeconds)}`
        const newPointShares = `${formatPercent(reuse.retainedPointCount / currentPointCount)}/${formatPercent(reuse.extendedPointCount / currentPointCount)}`
        const newTimeShares = `${formatPercent(reuse.retainedSeconds / currentSeconds)}/${formatPercent(reuse.extendedSeconds / currentSeconds)}`
        return [
            'trim + extend',
            `trim ${formatNumber(reuse.trimmedPointCount, 0)} pts / ${formatSeconds(reuse.trimmedSeconds)}`,
            `kept ${formatNumber(reuse.retainedPointCount, 0)} pts / ${formatSeconds(reuse.retainedSeconds)}`,
            `extend ${formatNumber(reuse.extendedPointCount, 0)} pts / ${formatSeconds(reuse.extendedSeconds)}`,
            `validation ${reuse.validation}${reuse.validation === 'performed' ? ` / ${formatSeconds(reuse.validationSeconds)}` : ''}`,
            `old pts trim/kept ${oldPointShares}; time ${oldTimeShares}`,
            `new pts kept/extend ${newPointShares}; time ${newTimeShares}`,
        ].join(' · ')
    }
    if (reuse.mode === 'full') {
        const divergence = formatDivergence(reuse.divergence)
        return `full${reuse.fallbackReason ? ` · ${reuse.fallbackReason}` : ''}${divergence ? ` · ${divergence}` : ''}`
    }
    return '—'
}
const formatFarReuse = (prediction) =>
    formatReuseDetails({
        divergence: prediction.farReuseDivergence,
        extendedPointCount: prediction.farReuseExtendedPointCount,
        extendedSeconds: prediction.farReuseExtendedSeconds,
        fallbackReason: prediction.farReuseFallbackReason,
        mode: prediction.farReuseMode,
        retainedPointCount: prediction.farReuseRetainedPointCount,
        retainedSeconds: prediction.farReuseRetainedSeconds,
        trimmedPointCount: prediction.farReuseTrimmedPointCount,
        trimmedSeconds: prediction.farReuseTrimmedSeconds,
        validation: prediction.farReuseValidation,
        validationSeconds: prediction.farReuseValidationSeconds,
    })
let latestRawSnapshotJson = '{}'
let renderedRecentDebugSnapshotsJson = ''

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

const getInstalledExtensionVersion = () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getManifest) {
        return null
    }

    return chrome.runtime.getManifest().version
}

const getPublishedExtensionVersionExpression = () => `(() => {
    try {
      const request = new XMLHttpRequest();
      const versionUrl = new URL('/${devtoolsVersionFileName}', window.location.href);
      request.open('GET', versionUrl.href, false);
      request.send();

      if (request.status < 200 || request.status >= 300) {
        return { ok: false, error: 'version file returned HTTP ' + request.status };
      }

      const body = JSON.parse(request.responseText);
      if (typeof body.extensionVersion !== 'string') {
        return { ok: false, error: 'version file is missing extensionVersion' };
      }

      return { ok: true, extensionVersion: body.extensionVersion };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  })()`

const compareVersions = (leftVersion, rightVersion) => {
    const leftParts = leftVersion.split('.').map(Number)
    const rightParts = rightVersion.split('.').map(Number)
    const partCount = Math.max(leftParts.length, rightParts.length)

    for (let index = 0; index < partCount; index += 1) {
        const left = leftParts[index] || 0
        const right = rightParts[index] || 0

        if (left !== right) {
            return left > right ? 1 : -1
        }
    }

    return 0
}

const setVersionStatus = (state, text, title = text) => {
    elements.versionStatus.textContent = text
    elements.versionStatus.title = title
    elements.versionStatus.className = `version-status ${state}`
}

const checkExtensionVersion = async () => {
    const installedVersion = getInstalledExtensionVersion()

    if (!installedVersion) {
        setVersionStatus('unavailable', 'Ext version: unavailable')
        return
    }

    try {
        const response = await evalInInspectedPage(getPublishedExtensionVersionExpression())

        if (response?.ok !== true) {
            throw new Error(response?.error || 'version check failed')
        }

        const publishedVersion = response.extensionVersion
        const comparison = compareVersions(installedVersion, publishedVersion)

        if (comparison < 0) {
            setVersionStatus(
                'outdated',
                `Ext v${installedVersion}: update to v${publishedVersion}`,
                'Reload the unpacked Space Web Game DevTools extension in chrome://extensions.',
            )
            return
        }

        if (comparison > 0) {
            setVersionStatus(
                'ahead',
                `Ext v${installedVersion}: ahead of app v${publishedVersion}`,
                'The installed extension is newer than the inspected app.',
            )
            return
        }

        setVersionStatus('current', `Ext v${installedVersion}: up to date`)
    } catch (error) {
        setVersionStatus(
            'unavailable',
            `Ext v${installedVersion}: cannot check`,
            error.message,
        )
    }
}

const sendBridgeRequest = async (request) => {
    const response = await evalInInspectedPage(getBridgeExpression(request))

    if (response?.ok !== true) {
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

const renderRecentDebugSnapshots = (snapshot) => {
    const recentSnapshots = Array.isArray(snapshot.recentDebugSnapshots)
        ? snapshot.recentDebugSnapshots
        : []
    const recentSnapshotsJson = JSON.stringify(recentSnapshots)
    if (recentSnapshotsJson === renderedRecentDebugSnapshotsJson) {
        return
    }
    renderedRecentDebugSnapshotsJson = recentSnapshotsJson

    if (recentSnapshots.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'muted debug-snapshot-empty'
        empty.textContent = 'No saved debug snapshots'
        elements.recentDebugSnapshotList.replaceChildren(empty)
        return
    }

    const items = recentSnapshots.map((snapshotEntry) => {
        const item = document.createElement('div')
        item.className = 'debug-snapshot-item'

        const details = document.createElement('div')
        details.className = 'debug-snapshot-details'

        const name = document.createElement('strong')
        name.className = 'debug-snapshot-name'
        name.textContent = snapshotEntry.name

        const savedAt = document.createElement('span')
        savedAt.className = 'debug-snapshot-saved-at'
        savedAt.textContent = new Date(snapshotEntry.savedAt).toLocaleString()

        const copyButton = document.createElement('button')
        copyButton.type = 'button'
        copyButton.textContent = 'Copy URL'
        copyButton.dataset.copyDebugSnapshotUrl = snapshotEntry.url
        copyButton.dataset.debugSnapshotName = snapshotEntry.name
        copyButton.setAttribute('aria-label', `Copy URL for ${snapshotEntry.name}`)

        const openButton = document.createElement('button')
        openButton.type = 'button'
        openButton.textContent = 'Open URL'
        openButton.dataset.openDebugSnapshotUrl = snapshotEntry.url
        openButton.dataset.debugSnapshotName = snapshotEntry.name
        openButton.setAttribute('aria-label', `Open URL for ${snapshotEntry.name}`)

        const actions = document.createElement('div')
        actions.className = 'debug-snapshot-actions'
        actions.append(copyButton, openButton)

        details.append(name, savedAt)
        item.append(details, actions)
        return item
    })

    elements.recentDebugSnapshotList.replaceChildren(...items)
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

const renderFarReuseHistory = (history) => {
    const entries = (history || []).slice(-reuseHistoryLimit).reverse().map((reuse) => {
        const item = document.createElement('li')
        item.textContent = `at ${formatSeconds(reuse.elapsedSeconds)} · ${formatReuseDetails(reuse)}`
        return item
    })

    elements.predictionFarReuseHistory.replaceChildren(...entries)
}

const renderPredictionSampling = (snapshot) => {
    const sampling = snapshot.simulation.predictionSampling
    const prediction = snapshot.simulation.trajectoryPrediction

    elements.predictionSampleStep.textContent = sampling
        ? formatSeconds(sampling.currentStepSeconds)
        : '—'
    elements.predictionIntegrationStep.textContent = sampling
        ? formatSeconds(sampling.currentMaxIntegrationStepSeconds)
        : '—'
    elements.predictionRefreshInterval.textContent = sampling
        ? formatSeconds(sampling.refreshInterval)
        : '—'
    elements.predictionTargetSteps.textContent = sampling
        ? formatNumber(sampling.targetMaxSteps, 0)
        : '—'

    if (!prediction) {
        elements.predictionRefreshSummary.textContent = '—'
        elements.predictionNearCalculation.textContent = '—'
        elements.predictionFarCalculation.textContent = '—'
        elements.predictionFarReuse.textContent = '—'
        elements.predictionFarReuseHistory.replaceChildren()
        elements.predictionFarCoalescing.textContent = '—'
        elements.predictionNearTravel.textContent = '—'
        elements.predictionIntegrationStats.textContent = '—'
        elements.predictionGeometryDuration.textContent = '—'
        elements.predictionTierState.textContent = '—'
        elements.predictionPointCounts.textContent = '—'
        elements.predictionEventSummary.textContent = '—'
        elements.predictionInputKeys.textContent = '—'
        renderFarCoalescingControls(null)
        return
    }

    const latestEvent = prediction.events?.at(-1)
    const tierState = [
        `split ${formatBool(prediction.splitHorizon)}`,
        `far ${prediction.farVisible || 'none'}`,
        `active ${formatBool(prediction.activeFar)}`,
        `pending ${formatBool(prediction.pendingFar)}`,
    ].join(' · ')
    const pointCounts = [
        `near ${formatNumber(prediction.nearPointCount, 0)}`,
        `far ${formatNumber(prediction.farPointCount, 0)}`,
        `visible ${formatNumber(prediction.visiblePointCount, 0)}`,
        `abs/rel/assist ${formatNumber(prediction.absolutePointCount, 0)}/${formatNumber(prediction.relativePointCount, 0)}/${formatNumber(prediction.assistedPointCount, 0)}`,
    ].join(' · ')
    const eventSummary = [
        `markers ${formatNumber(prediction.eventMarkerCount, 0)}`,
        `log ${formatNumber(prediction.events?.length ?? 0, 0)}`,
        latestEvent ? `last ${latestEvent.event}` : null,
        latestEvent?.changedParts?.length
            ? `changed ${latestEvent.changedParts.join(', ')}`
            : null,
    ]
        .filter(Boolean)
        .join(' · ')
    const inputKeys = [
        `current ${prediction.inputKeyShort || '—'}`,
        `far ${prediction.farInputKeyShort || '—'}`,
        `active ${prediction.activeFarInputKeyShort || '—'}`,
        `pending ${prediction.pendingFarInputKeyShort || '—'}`,
    ].join(' · ')

    elements.predictionRefreshSummary.textContent =
        `${prediction.refreshReason || 'none'} ${formatMs(prediction.predictionRefreshMs)} · ${formatNumber(prediction.refreshCountLastSecond, 0)}/s · elapsed ${formatSeconds(prediction.elapsedSinceRefreshSeconds)}`
    elements.predictionNearCalculation.textContent = formatCalculationTiming(
        prediction.nearCalculationMs,
        prediction.nearCalculationAgeSeconds,
        prediction.nearCalculationWindows,
    )
    elements.predictionFarCalculation.textContent = formatCalculationTiming(
        prediction.farCalculationMs,
        prediction.farCalculationAgeSeconds,
        prediction.farCalculationWindows,
    )
    elements.predictionFarReuse.textContent = formatFarReuse(prediction)
    renderFarReuseHistory(prediction.farReuseHistory)
    elements.predictionFarCoalescing.textContent = formatFarCoalescing(prediction)
    renderFarCoalescingControls(prediction)
    elements.predictionNearTravel.textContent = formatNearTravel(
        prediction.nearCalculationTravel,
    )
    elements.predictionIntegrationStats.textContent = formatIntegrationStats(
        prediction.integrationTiers,
    )
    elements.predictionGeometryDuration.textContent = formatMs(
        prediction.geometryUpdateMs,
    )
    elements.predictionTierState.textContent = tierState
    elements.predictionPointCounts.textContent = pointCounts
    elements.predictionEventSummary.textContent = eventSummary
    elements.predictionInputKeys.textContent = inputKeys
}

const renderFarCoalescingControls = (prediction) => {
    const overrideSeconds = prediction?.farCoalescingMinIntervalOverrideSeconds
    const overrideEnabled = typeof overrideSeconds === 'number'
    elements.farCoalescingOverrideEnabled.checked = overrideEnabled

    if (document.activeElement !== elements.farCoalescingOverrideSeconds) {
        const displayedSeconds = overrideEnabled
            ? overrideSeconds
            : prediction?.farCoalescingMinIntervalSeconds
        elements.farCoalescingOverrideSeconds.value =
            typeof displayedSeconds === 'number' && Number.isFinite(displayedSeconds)
                ? String(displayedSeconds)
                : ''
    }
}

const applyFarCoalescingOverride = () => {
    const enabled = elements.farCoalescingOverrideEnabled.checked
    const rawValue = elements.farCoalescingOverrideSeconds.value.trim()

    if (enabled && rawValue === '') {
        appendCommandLog('Set far cooldown override', 'enter a non-negative seconds value', false)
        return
    }

    const value = Number(rawValue)

    if (enabled && (!Number.isFinite(value) || value < 0)) {
        appendCommandLog('Set far cooldown override', 'enter a non-negative seconds value', false)
        return
    }

    runCommand('Set far cooldown override', {
        type: 'set-far-coalescing-min-interval-override',
        value: enabled ? value : null,
    })
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
    renderRecentDebugSnapshots(snapshot)
    renderBodies(snapshot)
    renderPredictionSampling(snapshot)

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

const openDebugSnapshotUrl = async (button) => {
    const url = button.dataset.openDebugSnapshotUrl
    const urlLiteral = JSON.stringify(url).replaceAll('<', '\\u003c')

    try {
        await evalInInspectedPage(`window.location.assign(${urlLiteral})`)
        appendCommandLog(
            'Open debug snapshot URL',
            `${button.dataset.debugSnapshotName} opened`,
        )
    } catch (error) {
        appendCommandLog('Open debug snapshot URL', error.message, false)
    }
}

document.addEventListener('click', (event) => {
    const openSnapshotUrlButton = event.target.closest('[data-open-debug-snapshot-url]')
    if (openSnapshotUrlButton) {
        openDebugSnapshotUrl(openSnapshotUrlButton)
        return
    }

    const copySnapshotUrlButton = event.target.closest('[data-copy-debug-snapshot-url]')
    if (copySnapshotUrlButton) {
        copyText(copySnapshotUrlButton.dataset.copyDebugSnapshotUrl)
            .then(() => {
                appendCommandLog(
                    'Copy debug snapshot URL',
                    `${copySnapshotUrlButton.dataset.debugSnapshotName} copied`,
                )
            })
            .catch((error) => {
                appendCommandLog('Copy debug snapshot URL', error.message, false)
            })
        return
    }

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
        return
    }

    if (event.target === elements.farCoalescingOverrideEnabled) {
        applyFarCoalescingOverride()
    }
})

elements.refreshButton.addEventListener('click', () => {
    refreshSnapshot()
    checkExtensionVersion()
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

elements.farCoalescingApplyButton.addEventListener('click', () => {
    applyFarCoalescingOverride()
})

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.rawSnapshotPanel.classList.contains('hidden')) {
        closeRawSnapshotPanel()
    }
})

refreshSnapshot()
checkExtensionVersion()
setInterval(refreshSnapshot, pollIntervalMs)
