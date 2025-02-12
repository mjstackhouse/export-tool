# Export Tool

This is a [custom app](https://kontent.ai/learn/docs/custom-apps) for [Kontent.ai](https://kontent.ai/) that allows for users to export their content to an Excel or CSV file. This tool can also be used outside of Kontent.ai [here](https://export-tool.netlify.app/). The user chooses the content types, language, and workflow step of the content items being exported. They can also use three optional filters: the item name, collection, and last modified date. When exported, the items are separated by type.

- If the user chooses the Excel file type, the content types are separated into worksheets, and then exported together in a single workbook.

- If the user chooses the CSV file type, each content type is separated into its own CSV file, and then exported together as a ZIP file.

![Screenshot of the custom app](content-export-tool-demo.gif)

## Deploying

If you would like to deploy and host your own version of this app, Netlify has made this easy. If you click the deploy button below, it will guide you through the process of deploying it to Netlify and leave you with a copy of the repository in your GitHub account as well.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/mjstackhouse/content-export-tool)

But, if you would like to receive updates automatically when they're released, then you can use the following link for your custom app's URL:
[https://export-tool.netlify.app/](https://export-tool.netlify.app/)

## Configuring the Custom App

This custom element requires no JSON parameters, so the parameters input can be left empty.

But, if you'd like to add your Delivery Preview API key to the configuration, you can do that like so:
```
{
  "deliveryKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwOGVjN2EyY2Y1OWQ0YjY2YTUyNDcyNmZjYzY0ZDM1OCIsImlhdCI6MTczODYyMzYwOCwibmJmIjoxNzM4NjIzNjA4LCJleHAiOjE3NzAxNTk1NDAsInZlciI6IjIuMC4wIiwic2NvcGVfaWQiOiI4YWQxODQ5Y2VlNTM0ZDFmODNiNzVlOTMzYWRiNzQ1NSIsInByb2plY3RfY29udGFpbmVyX2lkIjoiNzk0MjRmOWFkNGE2MDBjYzRhN2ZiYTFkYmU5OTMwMTQiLCJhdWQiOiJkZWxpdmVyLmtvbnRlbnQuYWkifQ.nNr6oS9MwrOxgYHyZAjxA6HPesjRnuUi26AnYw04vJQ"
}
```

The key needs to have 'Content preview' enabled, and if your environment has 'Secure access' enabled, then the key needs that as well.

Adding the key to your configuration will technically expose the key to any roles allowed to use the custom app (if they go looking for it), but it will also speed up the process for the user, so this is ultimately up to whoever configures the custom app.