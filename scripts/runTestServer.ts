import { resolve } from 'path'
import express = require('express')
import path = require('path')
import fs = require('fs')
import titere = require('titere')
import http = require('http')

// defines if we should run headless tests and exit (true) or keep the server on (false)
const singleRun = !(process.env.SINGLE_RUN === 'true')
const port = process.env.PORT || 8080
const app = express()

const server = http.createServer(app)

/// --- SIDE EFFECTS ---
{
  app.use(require('cors')())

  app.get('/test', (req, res) => {
    res.writeHead(200, 'OK', {
      'Content-Type': 'text/html'
    })

    res.write(`<!DOCTYPE html>
      <html>

      <head>
        <title>Mocha Tests</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="/node_modules/mocha/mocha.css">
      </head>

      <body>
        <div id="mocha"></div>
        <script>console.log('test html loaded')</script>
        <script src="/node_modules/mocha/mocha.js"></script>
        <script>mocha.setup('bdd');</script>
        <script src="/test/out/index.js"></script>
      </body>

      </html>
    `)

    res.end()
  })

  app.use(
    '/@/artifacts/index.js',
    express.static(resolve(__dirname, '../static/index.js'), {
      setHeaders: (res) => {
        res.setHeader('Content-Type', 'application/javascript')
      }
    })
  )

  app.use('/@/artifacts/unity-renderer', express.static(path.dirname(require.resolve('@zqbflynn/unity-renderer'))))

  app.use('/default-profile', express.static(resolve(__dirname, '../static/default-profile')))

  app.use(
    '/preview.html',
    express.static(resolve(__dirname, '../static/preview.html'), {
      setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/html')
      }
    })
  )

  app.use(
    '/index.html',
    express.static(resolve(__dirname, '../static/index.html'), {
      setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/html')
      }
    })
  )

  app.use('/test', express.static(resolve(__dirname, '../test')))
  app.use('/node_modules', express.static(resolve(__dirname, '../node_modules')))

  app.use(express.static(path.resolve(__dirname, '..', 'static')))

  server.listen(port, function () {
    console.info('==>     Listening on port %s. Open up http://localhost:%s/test to run tests', port, port)
    console.info('                              Open up http://localhost:%s/ to test the client.', port)

    const options: titere.Options = {
      file: `http://localhost:${port}/test`,
      visible: true,
      height: 600,
      width: 800,
      timeout: 5 * 60 * 1000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--debug-devtools-frontend', '--js-flags="--expose-gc"']
    }

    if (!singleRun) {
      titere
        .run(options)
        .then((result) => {
          if (result.coverage) {
            fs.mkdirSync('test/tmp', { recursive: true })
            fs.writeFileSync('test/tmp/out.json', JSON.stringify(result.coverage))
          }
          process.exit(result.result.stats.failures)
        })
        .catch((err: Error) => {
          console.error(err.message || JSON.stringify(err))
          console.dir(err)
          process.exit(1)
        })
    }
  })
}
