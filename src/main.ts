import './style.css'
import './ui/timeWarpFeedback.css'

import { createGameApp } from './app/createGameApp'
import { gameConfig } from './config/gameConfig'
import { installNativeTouchZoomSuppression } from './ui/nativeTouchZoomSuppression'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app element')
}

installNativeTouchZoomSuppression(app)

const tabTitleSuffix = gameConfig.tabTitleSuffix?.trim()

if (tabTitleSuffix) {
  document.title = `${document.title} ${tabTitleSuffix}`
}

const showStartupError = () => {
  const bootLabel = document.querySelector<HTMLElement>('.boot-label')
  if (bootLabel) {
    bootLabel.textContent = 'Startup failed'
  }
}

void createGameApp(app).catch((error) => {
  showStartupError()
  console.error(error)
})
