import 'dotenv/config';
import { installConsoleBridge } from './utils/logger.js';

installConsoleBridge();

void import('./index.js');
