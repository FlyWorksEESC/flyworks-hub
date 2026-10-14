import {parentPort,workerData} from 'node:worker_threads';
import {Store} from './core.mjs';
const {path,...config}=workerData;const s=new Store(path);try{s.cast(config);parentPort.postMessage(201)}catch(error){parentPort.postMessage(error.status||500)}finally{s.close()}
