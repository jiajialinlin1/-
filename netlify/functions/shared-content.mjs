import {
  badRequestResponse,
  getContentStore,
  isAuthorized,
  jsonResponse,
  methodNotAllowedResponse,
  unauthorizedResponse,
} from "./_shared/portfolio-shared.mjs";

const CONTENT_KEY = "site-content.json";

export default async function handler(request) {
  const contentStore = getContentStore();

  if (request.method === "GET") {
    const document = await contentStore.get(CONTENT_KEY, {
      type: "json",
    });

    if (!document) {
      return jsonResponse(
        {
          message: "No shared content saved yet.",
        },
        404,
      );
    }

    return jsonResponse(document);
  }

  if (request.method === "PUT") {
    if (!isAuthorized(request)) {
      return unauthorizedResponse();
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return badRequestResponse("Invalid JSON payload.");
    }

    if (!body || typeof body !== "object") {
      return badRequestResponse("Shared content payload must be an object.");
    }

    const document = {
      ...body,
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    await contentStore.setJSON(CONTENT_KEY, document);
    return jsonResponse(document);
  }

  return methodNotAllowedResponse("GET, PUT");
}
