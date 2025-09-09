import { PyodideInterface, loadPyodide } from 'pyodide';
import express, { Express, Request, Response } from "express";
import { PyodidePythonEnvironment } from '../src/services/python-interpreter/service';
import { PythonEnvironment } from './services/python-interpreter/types';
import { doWithLock } from './utils/async-utils';


const pythonEnvironment: PythonEnvironment = new PyodidePythonEnvironment();
// prepare python env before a request comes in
pythonEnvironment.init()

//
// The main http endpoint 
//
// Can create more express apps if we need multiple services.
const terrariumApp: Express = express();
terrariumApp.use(express.json({ limit: '100mb' }));

async function runRequest(req: any, res: any): Promise<void> {
    res.setHeader("Content-Type", "application/json");

    // make sure pyodide is loaded
    await pythonEnvironment.waitForReady();

    //
    // parse the request body (code, files, packages)
    //
    const code = req.body.code
    if (code == undefined || code.trim() == "") {
        res.send(JSON.stringify({ "success": false, "error": { "type": "parsing", "message": "no code provided" } }) + "\n");
        return
    }
    let files: any[] = [] // { "filename": "file.txt", "b64_data": "dGhlc..." }]
    if (req.body.files != undefined) {
        files = req.body.files
        console.log("Got " + files.length + " input files")
        console.log(files.map(f => f.filename + " " + f.b64_data.slice(0, 10) + "... " + f.b64_data.length))
    }
    let packages: string[] | undefined = undefined
    if (Array.isArray(req.body.packages)) {
        packages = req.body.packages.filter((p: any) => typeof p === 'string')
        console.log("Requested packages:", packages)
    }

    const result = await pythonEnvironment.runCode(code, files, packages);

    // write out the answer, but do not close the response yet - otherwise gcp cloud functions terminate the cpu cycles and hibernate the recycling
    res.write(JSON.stringify(result) + "\n");

    console.log("Reloading pyodide");

    // run the recycle background process'
    // see https://cloud.google.com/functions/docs/bestpractices/tips#do_not_start_background_activities

    await pythonEnvironment.terminate();
    await pythonEnvironment.cleanup();

    // to make gcp run it until the promise resolves & only now close the response connection
    res.end()
}

terrariumApp.post('', async (req, res) => {
    // queue 1 request at a time - might be better in express.js middleware probably if we run into issues (example: https://www.npmjs.com/package/express-queue though not maintained)
    await doWithLock('python-request', () => runRequest(req, res));
});

terrariumApp.get('/health', (req, res) => {
    res.send("hi!");
});


const server = terrariumApp.listen(8080, () => {
    console.log("Server is running on port 8080");
});
