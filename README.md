# GIP Dashboard

Dashboard for Gonsis Improvement Proposals (GIPs)

## Overview

The GIP Dashboard is designed to facilitate the management and visualization of Gnosis Improvement Proposals using a React-based frontend.

## Installation

To get started with the GIP Dashboard, clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd gip_dashboard_react
npm install
```

## Available Scripts

In the project directory, you can run several scripts depending on the required action:

### `npm start`

Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser. The page will reload when you make changes. You may also see any lint errors in the console.

### `npm run build`

Builds the app for production to the \`build\` folder. It correctly bundles React in production mode and optimizes the build for the best performance. The build is minified, and the filenames include the hashes.

### `npm run generate-yaml`

Executes a Node.js script located at \`./src/generateYaml.js\`. This will run the crawler for __https://snapshot.org/__ and __https://forum.gnosis.io/__ in order to build the GIP ymal files.

### `npm run setup-env`

Executes a shell script \`setup_environment.sh\` located in \`./src/scripts\`. This script is used for setting up or configuring the python environment required by the crawler.

