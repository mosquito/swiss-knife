# Swiss Knife - Privacy-First Developer Toolkit

A **100% client-side** developer toolkit running entirely in your browser with **zero network access**. No data ever leaves your device.

**[Open App](https://mosquito.github.io/swiss-knife/)** | **[Download Offline Version](https://mosquito.github.io/swiss-knife/swiss-knife.zip)**

## Privacy & Security

- **100% Client-Side** - All operations happen in your browser
- **Network Disabled** - Actively blocks all network requests
- **No Analytics** - Zero tracking, no cookies, no telemetry
- **Offline Capable** - Download and run as a single HTML file
- **Open Source** - Inspect the code yourself

## Tools

| Tool | Description |
|------|-------------|
| **JWT** | Encode/decode/verify JSON Web Tokens with time claims picker |
| **Hashes** | Compute cryptographic hashes in multiple output formats |
| **Encode/Decode** | Convert data between various encoding formats |
| **Data Formats** | Transform and format structured data |
| **Barcodes** | Generate and scan various barcode formats |
| **IP Calculator** | IPv4/IPv6 subnet calculations and conversions |
| **Date/Time** | Unix timestamp converter with timezone support |
| **Crypto** | Symmetric and asymmetric encryption tools |
| **Passwords** | Generate secure passphrases from wordlist |
| **Password Hash** | Bcrypt password hashing and verification |
| **UUID** | Generate and validate various UUID formats |
| **WiFi QR** | Generate QR codes for WiFi credentials |
| **Unit Converter** | Convert between measurement units |

## Feature Details

### JWT Tool
- Algorithms: HS256, HS384, HS512, RS256, RS384, RS512
- Auto-generates keys for selected algorithm
- Extracts public key from RSA private key
- Time claims picker (iat, exp, nbf) with datetime inputs
- Real-time signature verification with visual feedback
- Payload history with restore functionality
- Syntax-highlighted token display

### Hash Tool
- Algorithms: MD5, SHA-1, SHA-256, SHA-384, SHA-512, BLAKE2b, BLAKE2s
- Output formats: Hexadecimal, Base64, Base32, Base85
- Real-time computation as you type

### Encode/Decode Tool
- Formats: Base64, Base32, Base58, Base85 (ASCII85), Hexadecimal, URL encoding
- Bidirectional conversion
- Auto-detection of input format

### Data Formats Tool
- JSON to YAML conversion and vice versa
- XML/HTML formatting and minification
- Syntax validation with error reporting

### Barcode Tool
- Generate: QR Code, Code128, EAN-13, EAN-8, UPC-A, DataMatrix, PDF417, ITF-14, Codabar
- Scan: Camera-based QR/barcode scanning
- Download generated barcodes as images
- Scan history with timestamps

### IP Calculator
- IPv4 and IPv6 support
- CIDR notation parsing
- Network/broadcast address calculation
- Usable host range
- Multiple output encodings: Decimal, Hex, Binary, Base32, Base58, Base64

### Date/Time Tool
- Unix timestamp to human-readable conversion
- Support for seconds, milliseconds, microseconds
- Timezone selection
- Current time with live updates

### Crypto Tool
- AES encryption: GCM and CBC modes (128/256-bit keys)
- RSA key pair generation (2048/4096-bit)
- Secure random data generation (hex, base64, bytes)
- Password-based key derivation

### Password Generator
- Wordlist-based passphrase generation
- Configurable word count (2-10 words)
- Stochastic symbol and number placement (random positions)
- Custom separator characters with mixed mode
- URL-safe mode (restricts to - _ . ~ +)
- Capitalization options
- Entropy estimation display
- Generates 24 passwords at once

### Password Hash Tool
- Bcrypt hashing with configurable cost factor (4-31 rounds)
- Password verification against existing hashes
- Visual strength indicator

### UUID Tool
- Generate: UUIDv1 (timestamp), UUIDv4 (random), UUIDv5 (namespace), UUIDv7 (timestamp+random)
- Short UUID formats: Flickr Base58, Base32, Base64
- Batch generation (up to 100)
- UUID parsing and validation
- Timestamp extraction from v1/v7

### WiFi QR Tool
- Generate QR codes for WiFi network sharing
- Support for WPA/WPA2/WPA3, WEP, and open networks
- Hidden network option
- Download QR as image

### Unit Converter
- Categories: Length, Weight, Temperature, Data, Time, Area, Volume, Speed
- Real-time conversion as you type
- Common unit presets

## Quick Start

```bash
npm install
npm start      # Development server with hot reload
npm run build  # Production build (outputs to dist/ and dist-offline/)
```

### Build Outputs

- `dist/` - Standard production build with separate assets
- `dist-offline/` - Single HTML file with all assets inlined (fully offline capable)

## License

MIT
