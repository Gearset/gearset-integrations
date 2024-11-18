
# gearset-integrations

This repository provides foundational code snippets for integrating **Gearset** with various external systems. The examples are intended to demonstrate potential integration approaches and serve as a starting point for customizing Gearset workflows with other tools and services.

> **Note**: The code snippets in this repository are provided "as-is" under the [Apache 2.0 License](./LICENSE). They are **examples only** and should be tailored to fit your specific requirements. We accept no responsibility or liability for their use.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Available Integrations](#available-integrations)
- [Customization](#customization)
- [License](#license)

---

## Getting Started

To use any of the provided integration snippets:
1. Clone this repository to your local environment.
   ```bash
   git clone https://github.com/your-org/gearset-integrations.git
   ```
2. Navigate to the directory of the desired integration.
3. Review the provided code, modify it as necessary for your specific use case, and ensure it meets any security and compliance requirements relevant to your organization.

## Available Integrations

### 1. Google Sheets
   - **Description**: Code to synchronize Reporting API information from Gearset into Google Sheets, enabling time-defined tracking and reporting.
   - **Example Use Case**: Automate the Lead Time for Changes velocity metrics for a particular Pipeline into sheets for visualisation.
   - **Documentation**: See [here](https://docs.gearset.com/en/articles/10062950-using-google-sheets-with-gearset-s-reporting-api) for setup instructions and example usage.

## Customization

Each example is meant to be a **starting point** for your custom integration needs. Some points to consider:
- **API Keys and Authentication**: Ensure secure handling of credentials, environment variables, or OAuth tokens as needed for each integration.
- **Error Handling and Logging**: Customize error handling based on the operational requirements of your integration.
- **Performance Considerations**: Adapt polling intervals, batch sizes, or timeout settings according to the capacity and response times of the connected systems.

## License

This repository is licensed under the [Apache License 2.0](./LICENSE). All code snippets are provided "as-is" and intended solely as examples. Please review the license terms to ensure compliance.

**Disclaimer**: The code provided here is for demonstration purposes only. We make no guarantees regarding its functionality or security in any production environment. It is the user's responsibility to modify and validate the code to fit their specific needs.

---

Enjoy automating your Gearset workflows with these integration snippets!
