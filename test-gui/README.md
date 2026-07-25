# test-gui

A small vite app to render `JsonConfigComponent` from `../src` directly, so schema and component changes can be tried
out without building the library or installing it into admin.

## Run

```bash
cd test-gui
npm install
npm start          # http://localhost:3000
```

A **running ioBroker with admin on port 8081** is required - the components talk to it over `AdminConnection`
(object browser, instances, users, rooms, functions, certificates, files, ...).

## What it shows

`src/jsonConfig.json` is a demo schema of type `tabs` that exercises 59 of the 63 component types registered in
`src/JsonConfigComponent/ConfigPanel.tsx`, grouped into 8 tabs:

| Tab                | Contains                                                              |
| ------------------ | --------------------------------------------------------------------- |
| Text & Numbers     | text, password, pattern, number, port, ip, slider, chips, color, coordinates, datePicker, timePicker, cron |
| Selects            | select, autocomplete, checkbox, language, user, instance, room, func, interface, certificate, certCollection, credential |
| Objects & Files    | objectId, state, setState, alive, topic, file, fileSelector, image, staticImage |
| Static & Info      | header, divider, staticText, staticLink, staticInfo, infoBox, qrCode, iframe, uuid |
| Table & Accordion  | table, accordion                                                       |
| Editors & Certs    | jsonEditor, yamlEditor, certificates, checkLicense, checkDocker         |
| License            | license (it opens its dialog on tab enter, hence its own tab)           |
| SendTo             | sendTo, textSendTo, selectSendTo, autocompleteSendTo, imageSendTo, qrCodeSendTo, iframeSendTo, oauth2 |

Not covered: `chip` and `sendto` (deprecated aliases of `chips` / `sendTo`), `custom` (needs a module federation
bundle) and `deviceManager` (needs the `DeviceManager` prop).

The **SendTo** tab talks to `admin.0`, which does not implement the `test` command, so those fields stay empty. That is
expected - point `ADAPTER_NAME` / `INSTANCE` in `src/App.tsx` at your own adapter to exercise them.

## Top bar

- **JSON Config / Data / Schema** - the rendered form, the live edited data, and the raw schema
- language, light/dark theme and expert mode toggles

Edited data, theme, language and the selected tab are kept in `localStorage` (`json-config-test-*`). Clear those keys
to start over.
