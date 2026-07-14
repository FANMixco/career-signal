# Frontend source

Edit the files in this directory, then run:

```sh
npm run frontend:build
```

The build script generates minified runtime files at the frontend root:

- `frontend/app.min.js`
- `frontend/styles.min.css`
- `frontend/content/app.*.json`

`frontend/app.min.js` joins the runtime config, app controller, widget loader, and localized `frontend/src/content/app.*.json` files so the shipped runtime does not fetch unminified JSON.
