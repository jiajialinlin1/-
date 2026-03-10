import {
  badRequestResponse,
  emptyResponse,
  getAdminPassword,
  methodNotAllowedResponse,
  unauthorizedResponse,
} from "./_shared/portfolio-shared.mjs";

export default async function handler(request) {
  if (request.method !== "POST") {
    return methodNotAllowedResponse("POST");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON payload.");
  }

  if (!body || typeof body.password !== "string") {
    return badRequestResponse("Missing password.");
  }

  if (body.password.trim() !== getAdminPassword()) {
    return unauthorizedResponse();
  }

  return emptyResponse(204);
}
