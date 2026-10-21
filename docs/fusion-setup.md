# Fusion setup for the enquiry form

The enquiry form posts each submission as JSON to an Adobe Workfront Fusion
webhook. This guide shows you how to import the Fusion scenario that turns each
submission into a Workfront request, and how to rebuild the scenario by hand if
the import fails.

The scenario is in `fusion/enquiry-scenario.blueprint.json`. It has three
modules:

1. A custom webhook that receives the submission.
2. A Workfront "Create a record" module that raises an issue (`OPTASK`) in the
   request queue project `6ad8d2f90005295eaf29343ebd663ed8`.
3. A webhook response that returns `{"ok":true,"id":"<issue ID>"}` to the
   browser.

## Before you begin

You need:

- A Fusion account in the `app.workfrontfusion.com` zone.
- A Workfront connection with permission to create issues in the queue project.
- The webhook named "Mclaren Request Webhook" (ID `200628`) in your Fusion
  organization. The blueprint refers to it by that ID.

A webhook can be attached to only one scenario at a time. Webhook `200628`
already belongs to the starter scenario "Integration Webhooks", so import the
blueprint into that scenario instead of into a new one.

## Import the blueprint

1. In Fusion, go to **Scenarios** and open the scenario that owns
   "Mclaren Request Webhook" (the starter scenario "Integration Webhooks").
2. Open the scenario menu (the three dots at the bottom of the canvas) and
   select **Import Blueprint**.
3. Choose `fusion/enquiry-scenario.blueprint.json`. The import replaces the
   scenario's flow with the three modules in this guide.
4. Select the **Workfront** module (module 2). In **Connection**, choose your
   Workfront connection. The blueprint doesn't carry a connection ID, so you
   must do this step yourself.
5. Select the **Webhooks** module and confirm that **Webhook** is
   "Mclaren Request Webhook".
6. Select **Save**.
7. Select **Run once**. Fusion first processes submissions that are already
   queued at the webhook: a test enquiry named "Demo test" and one empty probe
   request. The empty one fails on the Workfront step, and you can ignore it.
   Then submit the form on the site and confirm that the issue appears in the
   Workfront queue and that the browser shows the success message.
8. Turn on **Scheduling** so the scenario runs on every submission.

If the importer rejects a module, or a module opens with missing settings, use
the hand-build steps in this guide instead.

### Alternative: use a new scenario

If you prefer to keep the starter scenario as it is, create a new scenario, but
first free the webhook:

1. Open the starter scenario, select its **Webhooks** module, and remove the
   webhook from it (or delete the module). Fusion doesn't let two scenarios
   share one webhook.
2. In Fusion, go to **Scenarios** and select **Create a new scenario**.
3. Follow the import steps above from step 2 onward, in the new scenario.

## Payload contract

The site sends a `POST` request with the header `Content-Type: application/json`
and the following body. The webhook answers CORS preflight requests and returns
`Access-Control-Allow-Origin: *`, so the blueprint doesn't set a CORS header.

| Key | Type | Description |
| --- | --- | --- |
| `name` | string | Full name of the person. |
| `email` | string | Email address. |
| `phone` | string | Phone number. Empty when the person leaves it blank. |
| `country` | string | Country name. |
| `model` | string | Display name of the chosen model. Falls back to the slug. |
| `modelSlug` | string | Slug of the chosen model. |
| `message` | string | Free-text message. Empty when the person leaves it blank. |
| `consent` | boolean | Always `true`. The form doesn't submit without consent. |
| `source` | string | Always `contentful-demo`. |
| `pageUrl` | string | URL of the page that sent the enquiry. |
| `submittedAt` | string | Submission time as an ISO 8601 timestamp in UTC. |

Example body:

```json
{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "phone": "+44 7700 900123",
  "country": "United Kingdom",
  "model": "750S",
  "modelSlug": "750s",
  "message": "Please send me the available specifications.",
  "consent": true,
  "source": "contentful-demo",
  "pageUrl": "https://judgedicewt.github.io/contentful-demo/#/enquire/750s",
  "submittedAt": "2026-10-21T09:30:00.000Z"
}
```

The module 2 mappings refer to these keys as `{{1.name}}`, `{{1.email}}`, and
so on. If the mapping panel doesn't list the keys, open the webhook module,
select **Redetermine data structure**, and send one submission from the site
so Fusion learns the shape.

## Build the scenario by hand

The module identifiers in the blueprint (`workfront:createRecord` and
`gateway:WebhookRespond`) and their metadata are written from the Make
blueprint conventions that Fusion uses. They weren't checked against a public
export from a Fusion account, so your Fusion version might reject them. If it
does, add the three modules yourself with these settings. The result behaves the
same as the import. Build them in the scenario that owns "Mclaren Request
Webhook" (the starter scenario "Integration Webhooks"), because a webhook can be
attached to only one scenario at a time. To build in a new scenario instead,
first remove the webhook from the starter scenario.

### Module 1: Webhooks, Custom webhook

| Setting | Value |
| --- | --- |
| Module | Webhooks > Custom webhook |
| Webhook | Mclaren Request Webhook (ID `200628`) |
| Maximum number of results | 2 |

### Module 2: Adobe Workfront, Create a record

| Setting | Value |
| --- | --- |
| Module | Adobe Workfront > Create a record |
| Connection | Your Workfront connection |
| Record type | Issue (`OPTASK`) |
| Project ID | `6ad8d2f90005295eaf29343ebd663ed8` |
| Name | `Enquiry: {{1.model}} - {{1.name}}` |
| Description | The ten lines that follow, as one multi-line value |

If the **Project ID** field isn't listed under the record type's settings,
choose **Add item** under **Fields** and add `projectID`.

```text
Name: {{1.name}}
Email: {{1.email}}
Phone: {{1.phone}}
Country: {{1.country}}
Model: {{1.model}} ({{1.modelSlug}})
Message: {{1.message}}
Consent: {{1.consent}}
Source: {{1.source}}
Page: {{1.pageUrl}}
Submitted: {{1.submittedAt}}
```

### Module 3: Webhooks, Webhook response

| Setting | Value |
| --- | --- |
| Module | Webhooks > Webhook response |
| Status | `200` |
| Body | `{"ok":true,"id":"{{2.ID}}"}` |
| Custom headers, Key | `Content-Type` |
| Custom headers, Value | `application/json` |

Run once, then check the response headers the browser receives. They should
include `Access-Control-Allow-Origin`. Add that header to module 3 (Key
`Access-Control-Allow-Origin`, Value `*`) only if it is missing.

Connect the modules in order: 1, then 2, then 3. Turn on **Immediately as data
arrives** in the scenario settings, which matches `instant: true` in the
blueprint.

## Known limits

- Fusion's error handling decides what the browser sees when the Workfront
  step fails. Check this once by sending a submission while the Workfront
  module is misconfigured, for example with no connection chosen. Errors appear
  in the scenario's execution log, so check it after the first runs.
- The scenario has no error-handling branch. The blueprint allows three
  consecutive errors (`maxErrors: 3`). Confirm during **Run once** whether the
  scenario turns off after an error, and turn it back on if it does.
- The scenario doesn't store submissions anywhere else, doesn't email the
  person, and doesn't rate-limit requests or check for spam beyond the
  honeypot field on the form.
- The webhook URL is public by design. Anyone who has it can post to it, so
  treat the queue project as a test queue.
- Changing the payload keys on the site means updating the mappings in
  module 2.
