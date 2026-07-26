import JwtTool from './JwtTool';
import HashTool from './HashTool';
import EncodeDecodeTool from './EncodeDecodeTool';
import DateTimeTool from './DateTimeTool';
import DataFormatTool from './DataFormatTool';
import BarcodeTool from './BarcodeTool';
import IPCalcTool from './IPCalcTool';
import CryptoTool from './CryptoTool';
import PasswordTool from './PasswordTool';
import PasswordHashTool from './PasswordHashTool';
import UuidTool from './UuidTool';
import WifiQRTool from './WifiQRTool';
import UnitsConverterTool from './UnitsConverterTool';
import RegexTool from './RegexTool';

export const toolCategories = [
  {
    name: 'Security',
    tools: [
      { id: 'jwt', label: 'JWT Tool', icon: 'icon-lock', component: JwtTool },
      { id: 'hash', label: 'Hashes', icon: 'icon-bitcoin', component: HashTool },
      { id: 'crypto', label: 'Crypto Utils', icon: 'icon-shield', component: CryptoTool },
      { id: 'passwordhash', label: 'PW Hash', icon: 'icon-closed-eye', component: PasswordHashTool },
    ],
  },
  {
    name: 'Encoding',
    tools: [
      { id: 'regex', label: 'Regex Lab', icon: 'icon-regex', component: RegexTool },
      { id: 'encode', label: 'Encode / Decode', icon: 'icon-cycled-arrows', component: EncodeDecodeTool },
      { id: 'barcode', label: 'Barcodes', icon: 'icon-barcode', component: BarcodeTool },
      { id: 'format', label: 'Data Format', icon: 'icon-nodes', component: DataFormatTool },
    ],
  },
  {
    name: 'Network',
    tools: [
      { id: 'ipcalc', label: 'IP Calc', icon: 'icon-socket-cord', component: IPCalcTool },
      { id: 'wifiqr', label: 'WiFi QR', icon: 'icon-wireless', component: WifiQRTool },
    ],
  },
  {
    name: 'Utilities',
    tools: [
      { id: 'password', label: 'Password', icon: 'icon-abc', component: PasswordTool },
      { id: 'uuid', label: 'UUID', icon: 'icon-tag-id', component: UuidTool },
      { id: 'datetime', label: 'Date / Time', icon: 'icon-clock', component: DateTimeTool },
      { id: 'units', label: 'Units', icon: 'icon-bidirectional-arrows', component: UnitsConverterTool },
    ],
  },
];

export const allTools = toolCategories.flatMap((category) => category.tools);
export const toolIds = new Set(allTools.map((tool) => tool.id));
