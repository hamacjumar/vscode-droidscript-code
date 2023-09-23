module.exports = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Layout</title>
    <style>
        * {
            padding: 0;
            margin: 0;
            box-sizing: border-box;
        }
        body {
            padding: 2rem;
        }
        h4 {
            margin: 1.5rem 0;
        }
        li {
            margin-top: 1rem;
            padding: 0px 1rem;
        }
    </style>
</head>
<body>
    
    <h1>How to connect to DroidScript?</h1>

    <ol>
        <li>Open DroidScript app on your phone and press the WiFi icon to start the DS WiFi IDE server. You should be able to see the IP Address on the popup message.</li>
        <li>Click the <strong>"Connect"</strong> button in the Projects section or in the Samples section. You can also click the <strong>"Connect to DroidScript"</strong> button in the bottom right corner.</li>
        <li>A popup will be displayed where to enter <strong>"IP Address"</strong> and <strong>"Password"</strong> if necessary.</li>
    </ol>

    <br>
    <br>
    <br>
    
    <h1>How to open an app?</h1>

    <ol>
        <li>If you are successfully connected, go to <strong>DroidScript</strong> view.</li>
        <li>Expand the <strong>"PROJECTS"</strong> section and right-click on the name of the project you want to open.</li>
        <li>In the context menu, select <strong>"Open"</strong>.</li>
    </ol>

    <br>
    <br>
    <br>

    <h1>How to create an app?</h1>

    <ol>
        <li>Go to <strong>DroidScript</strong> view.</li>
        <li>In the <strong>"PROJECTS"</strong> section title, click the <strong>(+)</strong> icon at the right.</li>
        <li>A quick pick popup will be shown at the top. Select the type of app and follow the next step to "Enter app name" and "App type".</li>
    </ol>

    <br>
    <br>
    <br>

    <h1>How to rename an app?</h1>

    <ol>
        <li>Go to <strong>DroidScript</strong> view.</li>
        <li>Expand the <strong>"PROJECTS"</strong> section.</li>
        <li>Hover on the app you want to rename and click the <strong>"Pencil"</strong> icon.</li>
        <li>A popup message will open on the bottom right for confirmation.</li>
    </ol>

    <br>
    <br>
    <br>
    
    <h1>How to delete an app?</h1>

    <ol>
        <li>Go to <strong>DroidScript</strong> view.</li>
        <li>Expand the <strong>"PROJECTS"</strong> section.</li>
        <li>Hover on the app you want to remove and click the <strong>"Trash Bin"</strong> icon.</li>
        <li>A popup message will open on the bottom right for confirmation.</li>
    </ol>

</body>
</html>
`;