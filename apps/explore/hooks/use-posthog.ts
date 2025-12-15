import posthog from 'posthog-js'

export function usePostHog() {
  const capture = (event: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      posthog.capture(event, properties)
    }
  }

  const identify = (properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      posthog.identify(undefined, properties)
    }
  }

  return { capture, identify }
}
