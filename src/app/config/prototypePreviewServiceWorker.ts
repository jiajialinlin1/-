let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null;

export async function ensurePrototypePreviewServiceWorker() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = (async () => {
      const registration = await navigator.serviceWorker.register(
        "/prototype-preview-sw.js",
        { scope: "/" },
      );

      try {
        await registration.update();
      } catch {
        // Ignore update failures and keep the current active worker.
      }

      await navigator.serviceWorker.ready;
      return registration;
    })().catch((error) => {
      serviceWorkerRegistrationPromise = null;
      throw error;
    });
  }

  return serviceWorkerRegistrationPromise;
}
