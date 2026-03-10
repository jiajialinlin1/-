import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import {
  collectImageOverrideRefs,
  migrateImageOverridesToIndexedDb,
} from "./config/imageSettings";
import {
  collectProjectMediaRefs,
  migrateProjectsMediaToIndexedDb,
} from "./config/projectsSettings";
import { warmStoredMediaRefs } from "./config/mediaStorage";
import { ensurePrototypePreviewServiceWorker } from "./config/prototypePreviewServiceWorker";
import { bootstrapSharedContentCache } from "./config/sharedContentApi";

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrapMediaStorage = async () => {
      try {
        void ensurePrototypePreviewServiceWorker().catch(() => {});
        await bootstrapSharedContentCache();
        await migrateImageOverridesToIndexedDb();
        await migrateProjectsMediaToIndexedDb();
        await warmStoredMediaRefs([
          ...collectImageOverrideRefs(),
          ...collectProjectMediaRefs(),
        ]);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void bootstrapMediaStorage();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-white" />;
  }

  return <RouterProvider router={router} />;
}
