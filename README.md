# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.15.3 create --template minimal --types ts --no-install macro-observer
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Indicadores disponibles

| Indicador | World Bank Code | Unidad |
|-----------|----------------|--------|
| Inflación | FP.CPI.TOTL.ZG | % |
| GDP per cápita | NY.GDP.PCAP.CD | USD |
| Desempleo | SL.UEM.TOTL.ZS | % |
| Deuda pública | GC.DOD.TOTL.GD.ZS | % |
| Tipo de cambio | PA.NUS.FCRF | — |

## Comandos

```sh
npm run dev            # servidor de desarrollo
npm run dev:cf         # desarrollo con Cloudflare Workers local
npm run build          # build de producción
npm run preview        # preview del build
npm run check          # type check
npm run check:watch    # type check en modo watch
npm run test           # corre tests una vez
npm run test:watch     # tests en modo watch
npm run deploy         # build + deploy a Cloudflare Pages
```
