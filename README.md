# FeatBit Azure DevOps Extension

A web extension for Azure DevOps Server that integrates with FeatBit feature flag management platform.

## Features

- Create boolean feature flags directly from user stories
- View and manage feature flags associated with work items
- Toggle feature flags on/off from within Azure DevOps
- Secure configuration management for FeatBit connection settings

## Development

### Prerequisites

- Node.js 16 or later
- npm or yarn
- Azure DevOps Server 2019 or later
- FeatBit instance with API access

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Package the extension: `npm run package`

### Scripts

- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run watch` - Watch mode for development
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run package` - Create extension package

## Installation

1. Build and package the extension
2. Upload the .vsix file to your Azure DevOps Server
3. Configure FeatBit connection settings in project settings

## Configuration

Navigate to Project Settings > FeatBit Settings to configure:
- FeatBit server URL
- API key
- Project ID
- Environment

## License

MIT