# Content Export Tool

This custom app allows for users to export their content to an Excel or CSV file. The user can choose the content types of the items they want to export and the workflow step the content items are in.

## Deploying

Netlify has made this easy. If you click the deploy button below, it will guide you through the process of deploying it to Netlify and leave you with a copy of the repository in your GitHub account as well.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/mjstackhouse/content-export-tool)

## Configuring the Custom App

This custom element requires no JSON parameters, so the parameters input can be left empty.

But, if you'd like to add your Delivery Preview API key to the configuration, you can do that like so:
```
{
  "deliveryKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwOGVjN2EyY2Y1OWQ0YjY2YTUyNDcyNmZjYzY0ZDM1OCIsImlhdCI6MTczODYyMzYwOCwibmJmIjoxNzM4NjIzNjA4LCJleHAiOjE3NzAxNTk1NDAsInZlciI6IjIuMC4wIiwic2NvcGVfaWQiOiI4YWQxODQ5Y2VlNTM0ZDFmODNiNzVlOTMzYWRiNzQ1NSIsInByb2plY3RfY29udGFpbmVyX2lkIjoiNzk0MjRmOWFkNGE2MDBjYzRhN2ZiYTFkYmU5OTMwMTQiLCJhdWQiOiJkZWxpdmVyLmtvbnRlbnQuYWkifQ.nNr6oS9MwrOxgYHyZAjxA6HPesjRnuUi26AnYw04vJQ"
}
```

Adding the key to your configuration will technically expose the key to any roles allowed to use the custom app (if they go looking for it), but it will also speed up the process for the user, so this is ultimately up to whoever configures the custom app.