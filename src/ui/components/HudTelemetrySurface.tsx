import type { FpsMeterGraphModel, FpsMeterStatus } from '../hudText'

export type TelemetryStripRefs = {
  fuelIconLevel: SVGRectElement | null
  fuelPill: HTMLElement | null
  speedIcon: SVGSVGElement | null
  statFuel: HTMLElement | null
  statSpeed: HTMLElement | null
  statTarget: HTMLElement | null
  statTargetAltitude: HTMLElement | null
  statThrust: HTMLElement | null
  statTime: HTMLElement | null
  targetCluster: HTMLElement | null
  targetPill: HTMLElement | null
  targetSelectorButton: HTMLButtonElement | null
  targetSelectorButtonStatus: HTMLElement | null
  targetSelectorPopover: HTMLElement | null
  targetSphere: HTMLElement | null
  targetStatus: HTMLElement | null
  timeIcon: SVGSVGElement | null
  timeIconHand: SVGLineElement | null
}

export type FpsIndicatorView = {
  graph: FpsMeterGraphModel
  status: FpsMeterStatus
  text: string
}

type TelemetryStripSurfaceProps = {
  refs: TelemetryStripRefs
}

type FpsIndicatorSurfaceProps = {
  rootRef(element: HTMLElement | null): void
  view: FpsIndicatorView | null
}

type RocketWithFlameIconProps = {
  className?: string
  rootRef?(element: SVGSVGElement | null): void
}

export const RocketWithFlameIcon = ({
  className = 'telemetry-speed-icon',
  rootRef,
}: RocketWithFlameIconProps) => (
  <svg class={className} viewBox="0 0 16 16" aria-hidden="true" ref={rootRef}>
    <path
      class="telemetry-speed-icon-body"
      d="M8 1.5 L10.5 6.2 L10.2 10.1 L9 12.8 L7 12.8 L5.8 10.1 L5.5 6.2 Z"
    />
    <path
      class="telemetry-speed-icon-wing telemetry-speed-icon-wing-left"
      d="M5.7 8.8 L3.9 10.8 L5.8 11.1 Z"
    />
    <path
      class="telemetry-speed-icon-wing telemetry-speed-icon-wing-right"
      d="M10.3 8.8 L12.1 10.8 L10.2 11.1 Z"
    />
    <circle class="telemetry-speed-icon-window" cx="8" cy="6.1" r="0.95" />
    <path
      class="telemetry-speed-icon-flame"
      d="M8 14.6 C8.9 13.6, 9.3 12.4, 8 11.1 C6.7 12.4, 7.1 13.6, 8 14.6 Z"
    />
  </svg>
)

export const TelemetryStripSurface = ({ refs }: TelemetryStripSurfaceProps) => (
  <div class="telemetry-strip">
    <div class="telemetry-pill telemetry-pill-time">
      <span class="telemetry-time-display">
        <svg
          class="telemetry-time-icon"
          viewBox="0 0 16 16"
          aria-hidden="true"
          ref={(element) => {
            refs.timeIcon = element
          }}
        >
          <circle class="telemetry-time-icon-face" cx="8" cy="8" r="6.25" />
          <line
            class="telemetry-time-icon-hand telemetry-time-icon-hand-minute"
            x1="8"
            y1="8"
            x2="8"
            y2="3.5"
            ref={(element) => {
              refs.timeIconHand = element
            }}
          />
          <circle class="telemetry-time-icon-center" cx="8" cy="8" r="0.9" />
        </svg>
        <strong
          data-stat="time"
          ref={(element) => {
            refs.statTime = element
          }}
        />
      </span>
    </div>
    <div class="telemetry-pill telemetry-pill-thrust">
      <span class="telemetry-thrust-display">
        <svg
          class="telemetry-crash-icon telemetry-crash-icon-burst"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            class="telemetry-crash-icon-blast"
            d="M8 1.1 9 4.5 12.6 3.2 10.9 6.1 14.4 7.3 11.2 8.8 12.3 12 9.2 11.1 8 13.9 6.9 11.2 3.6 12.3 4.8 9.1 1.6 7.9 4.6 6.4 3.2 3.4 6.5 4.6Z"
          />
          <g class="telemetry-crash-icon-rocket">
            <path
              class="telemetry-crash-icon-rocket-body"
              d="M8 1.5 L10.5 6.2 L10.2 10.1 L9 12.8 L7 12.8 L5.8 10.1 L5.5 6.2 Z"
            />
            <path
              class="telemetry-crash-icon-rocket-wing"
              d="M5.7 8.8 L3.9 10.8 L5.8 11.1 Z"
            />
            <path
              class="telemetry-crash-icon-rocket-wing"
              d="M10.3 8.8 L12.1 10.8 L10.2 11.1 Z"
            />
            <circle
              class="telemetry-crash-icon-rocket-window"
              cx="8"
              cy="6.1"
              r="0.95"
            />
          </g>
        </svg>
        <strong
          data-stat="thrust"
          ref={(element) => {
            refs.statThrust = element
          }}
        />
      </span>
    </div>
    <div class="telemetry-critical-cluster">
      <div
        class="telemetry-pill telemetry-pill-fuel"
        style={{ display: 'none' }}
        ref={(element) => {
          refs.fuelPill = element
        }}
      >
        <span class="telemetry-fuel-display">
          <svg
            class="telemetry-fuel-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              class="telemetry-fuel-icon-tank"
              d="M5.1 2.2h5.8l1.25 1.7v8.4c0 .85-.55 1.5-1.42 1.5H5.27c-.87 0-1.42-.65-1.42-1.5V3.9Z"
            />
            <path class="telemetry-fuel-icon-cap" d="M5.6 2.2V1.3h4.8v.9" />
            <rect
              class="telemetry-fuel-icon-level telemetry-fuel-icon-live-level"
              x="5.65"
              y="3.95"
              width="4.7"
              height="8.6"
              rx="0.35"
              ref={(element) => {
                refs.fuelIconLevel = element
              }}
            />
          </svg>
          <strong
            data-stat="fuel"
            ref={(element) => {
              refs.statFuel = element
            }}
          />
        </span>
      </div>
      <div class="telemetry-pill telemetry-pill-velocity">
        <span class="telemetry-speed-display">
          <RocketWithFlameIcon
            rootRef={(element) => {
              refs.speedIcon = element
            }}
          />
          <strong
            data-stat="speed"
            ref={(element) => {
              refs.statSpeed = element
            }}
          />
        </span>
      </div>
    </div>
    <div
      class="telemetry-target-cluster"
      ref={(element) => {
        refs.targetCluster = element
      }}
    >
      <div
        class="telemetry-pill telemetry-pill-target"
        ref={(element) => {
          refs.targetPill = element
        }}
      >
        <span class="telemetry-target-display">
          <span
            class="target-body-sphere"
            data-stat="target-sphere"
            aria-hidden="true"
            ref={(element) => {
              refs.targetSphere = element
            }}
          />
          <strong
            data-stat="target"
            ref={(element) => {
              refs.statTarget = element
            }}
          />
          <span
            class="target-altitude"
            data-stat="target-altitude"
            ref={(element) => {
              refs.statTargetAltitude = element
            }}
          />
          <span
            class="target-status-mark"
            data-stat="target-status"
            aria-hidden="true"
            ref={(element) => {
              refs.targetStatus = element
            }}
          />
        </span>
      </div>
      <button
        aria-label="Select target (T)"
        aria-expanded="false"
        class="desktop-target-selector-button"
        title="Select target (T)"
        type="button"
        ref={(element) => {
          refs.targetSelectorButton = element
        }}
      >
        <span
          class="target-status-mark"
          aria-hidden="true"
          ref={(element) => {
            refs.targetSelectorButtonStatus = element
          }}
        />
      </button>
      <div
        class="desktop-target-selector-popover"
        hidden
        ref={(element) => {
          refs.targetSelectorPopover = element
        }}
      />
    </div>
  </div>
)

export const FpsIndicatorSurface = ({
  rootRef,
  view,
}: FpsIndicatorSurfaceProps) => (
  <div
    class="fps-indicator"
    data-status={view?.status}
    hidden={!view}
    aria-hidden={!view}
    ref={rootRef}
  >
    {view ? (
      <>
        <div class="fps-indicator-text">{view.text}</div>
        <svg
          class="fps-meter-graph"
          aria-hidden="true"
          viewBox={`0 0 ${view.graph.width} ${view.graph.height}`}
        >
          <rect
            class="fps-meter-graph-bg"
            x="0"
            y="0"
            width={view.graph.width}
            height={view.graph.height}
          />
          <line
            class="fps-meter-graph-budget"
            x1="0"
            x2={view.graph.width}
            y1={view.graph.budgetLineY}
            y2={view.graph.budgetLineY}
          />
          {view.graph.path ? (
            <path class="fps-meter-graph-line" d={view.graph.path} />
          ) : null}
          {view.graph.gcMarkerXs.map((x, index) => (
            <circle
              class="fps-meter-graph-gc"
              cx={x}
              cy={view.graph.height - 2}
              r="1.6"
              key={`${index}:${x.toFixed(1)}`}
            />
          ))}
        </svg>
      </>
    ) : null}
  </div>
)
