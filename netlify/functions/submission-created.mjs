// Runs automatically after every Netlify Forms submission and copies the lead into HubSpot.
// The form is still saved in Netlify, so nothing is lost if HubSpot is down.
const API = "https://api.hubapi.com";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clip = (s, n) => String(s ?? "").trim().slice(0, n);
const post = (path, body, token) =>
  fetch(API + path, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body) });

export const handler = async (event) => {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) { console.warn("HUBSPOT_ACCESS_TOKEN is not set. Skipping HubSpot."); return { statusCode: 200, body: "skipped" }; }
  try {
    const { payload } = JSON.parse(event.body);
    const d = payload.data || {};
    const email = clip(d.email, 200).toLowerCase();
    if (!email) return { statusCode: 200, body: "no email" };

    const [first, ...rest] = clip(d.name, 120).split(/\s+/);
    const props = { email };
    if (first) props.firstname = first;
    if (rest.length) props.lastname = rest.join(" ");
    if (d.business) props.company = clip(d.business, 120);
    const detail = clip(d["contact-detail"], 200);
    if (/^\+?[\d\s()-]{7,}$/.test(detail)) props.phone = detail;

    const up = await post("/crm/v3/objects/contacts/batch/upsert", { inputs: [{ idProperty: "email", id: email, properties: props }] }, token);
    if (!up.ok) { console.error("HubSpot contact failed", up.status, await up.text()); return { statusCode: 200, body: "contact failed" }; }
    const id = (await up.json()).results?.[0]?.id;
    if (!id) return { statusCode: 200, body: "no contact id" };

    const booking = payload.form_name === "consultation-booking";
    const rows = [
      ["Preferred contact", d["preferred-contact"]], ["Contact detail", detail], ["Service", d.service], ["Budget", d.budget],
      ["Meeting type", d["meeting-type"]], ["Preferred date", d["preferred-date"]], ["Preferred time", d["preferred-time"]], ["Time zone", d["time-zone"]],
    ].filter(([, v]) => v);
    const text = clip(d["project-details"] || d.agenda, 5000);
    const html = "<p><strong>Website " + (booking ? "booking request" : "enquiry") + "</strong></p><ul>" +
      rows.map(([k, v]) => "<li>" + esc(k) + ": " + esc(v) + "</li>").join("") + "</ul>" +
      (text ? "<p>" + esc(text).replace(/\n/g, "<br>") + "</p>" : "");

    const note = await post("/crm/v3/objects/notes", {
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: html },
      associations: [{ to: { id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
    }, token);
    if (!note.ok) console.error("HubSpot note failed", note.status, await note.text());
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.error("HubSpot sync error", e);
    return { statusCode: 200, body: "error" };
  }
};
