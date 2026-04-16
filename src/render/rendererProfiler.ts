import * as THREE from 'three'

export const createRendererProfiler = (renderer: THREE.WebGLRenderer) => {
  const gl = renderer.getContext() as WebGL2RenderingContext
  const gpuTimerExtension = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  const pendingGpuQueries: WebGLQuery[] = []
  let smoothedGpuMs: number | null = null

  const updatePendingGpuQueries = () => {
    if (!gpuTimerExtension) {
      return
    }

    while (pendingGpuQueries.length > 0) {
      const query = pendingGpuQueries[0]
      const available = gl.getQueryParameter(
        query,
        gl.QUERY_RESULT_AVAILABLE,
      ) as boolean
      const disjoint = gl.getParameter(
        gpuTimerExtension.GPU_DISJOINT_EXT,
      ) as boolean

      if (!available || disjoint) {
        break
      }

      const elapsedNanoseconds = gl.getQueryParameter(
        query,
        gl.QUERY_RESULT,
      ) as number
      smoothedGpuMs =
        smoothedGpuMs === null
          ? elapsedNanoseconds / 1_000_000
          : THREE.MathUtils.lerp(
              smoothedGpuMs,
              elapsedNanoseconds / 1_000_000,
              0.2,
            )
      gl.deleteQuery(query)
      pendingGpuQueries.shift()
    }
  }

  return {
    getSmoothedGpuMs: () => smoothedGpuMs,
    render: (
      scene: THREE.Scene,
      camera: THREE.Camera,
      performanceDebugEnabled: boolean,
    ) => {
      if (performanceDebugEnabled && gpuTimerExtension) {
        const disjoint = gl.getParameter(
          gpuTimerExtension.GPU_DISJOINT_EXT,
        ) as boolean

        if (!disjoint) {
          const query = gl.createQuery()

          if (query) {
            gl.beginQuery(gpuTimerExtension.TIME_ELAPSED_EXT, query)
            renderer.render(scene, camera)
            gl.endQuery(gpuTimerExtension.TIME_ELAPSED_EXT)
            pendingGpuQueries.push(query)
          } else {
            renderer.render(scene, camera)
          }
        } else {
          renderer.render(scene, camera)
        }

        updatePendingGpuQueries()
        return
      }

      renderer.render(scene, camera)
      smoothedGpuMs = null
    },
  }
}

export type RendererProfiler = ReturnType<typeof createRendererProfiler>
