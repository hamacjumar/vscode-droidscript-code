var native = `
function OnStart()
{
    lay = app.CreateLayout( "linear", "VCenter,FillXY" )

    img = app.CreateImage( "/Sys/Img/Hello.png", 0.2, -1, "button" )
    img.SetOnTouchUp( btn_OnTouch )
    lay.AddChild( img )

    app.AddLayout( lay )
}

function btn_OnTouch()
{
    app.ShowPopup( "Hello World!" )
    app.Vibrate( "0,100,30,100,50,300" )
}`;

var mui = `
cfg.Light
cfg.MUI

function OnStart()
{
    lay = MUI.CreateLayout("Linear", "VCenter,FillXY")
    lay.SetChildMargins(0, 0.02, 0, 0.02)

    var t = "Lorem ipsum dolor sit amet"
    txt = MUI.AddText(lay, t, 0.9, null, "Paragraph,Multiline")

    btn1 = MUI.AddButtonRaised(lay, "BUTTON", 0.35)
    btn1.SetOnTouch( OnBtnTouch )

    btn2 = MUI.AddButtonRaised(lay, "[fa-android] ANDROID", 0.35, null, "#009688")
    btn2.SetOnTouch( OnBtnTouch )

    tedt = MUI.AddTextEditFilled(lay, 0.7, "Left", "Username", true)
    tedt.SetOnChange( OnTextChange )

    app.AddLayout( lay )
}

function OnBtnTouch()
{
    app.ShowPopup( "Button is click!" );
}

function OnTextChange()
{
    app.ShowPopup( this.GetText() );
}
`;

var hybrid = [
    {
        fileName: "~<appname>.html",
        code: `<!DOCTYPE html>
<html>
    <head>
    <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
    <meta charset="UTF-8">
    <title>EnjineIO App</title>

    <script>_hybrid=true</script>
    <script src="file:///android_asset/app.js"></script>
    <script src="file:///android_asset/compat.js"></script>

    
    <script src="ds:/Plugins/ui/libs/react.development.js"></script>
    <script src="ds:/Plugins/ui/libs/react-dom.development.js"></script>
    <script src="ds:/Plugins/ui/libs/material-ui.development.js"></script>
    <script src="ds:/Plugins/ui/libs/material-ui-lab.production.min.js"></script>
    <script src="ds:/Plugins/ui/libs/swipeable-views.js"></script>
    <link rel="stylesheet" href="ds:/Plugins/ui/libs/material-icons.css">
    <link rel="stylesheet" href="ds:/Plugins/ui/libs/fonts.css">
    <link rel="stylesheet" href="ds:/Plugins/ui/libs/styles.css">
    <link rel="stylesheet" href="ds:/Plugins/ui/libs/animate.min.css">
    <script src="ds:/Plugins/ui/libs/moment.js"></script>
    <script src="ds:/Plugins/ui/libs/rome.standalone.js"></script>
    <script src="ds:/Plugins/ui/libs/material-datetime-picker.js" charset="utf-8"></script>
    <link rel="stylesheet" href="ds:/Plugins/ui/libs/material-datetime-picker.css">
    <script src="ds:/Plugins/ui/libs/date-time-picker/js/draggabilly.pkgd.min.js"></script>
    <script src="ds:/Plugins/ui/libs/date-time-picker/js/datetimepicker.js"></script>

    <script src="ds:/Plugins/ui/libs/ui.js"></script>
    <script src="ds:/Plugins/ui/libs/obj.js"></script>
    <script src="ds:/Plugins/ui/libs/enjine-ui.js"></script>
    
    <script src="<appname>.js"></script>
    </head>

    
    <body onload="if( typeof onStart=='function' ) onStart(); else main = new Main()">
    
    <link id="_id_theme" rel="stylesheet" href="ds:/Plugins/ui/libs/light.css">
    <link rel="stylesheet" id="_id_picker_theme" href="ds:/Plugins/ui/libs/date-time-picker/css/light.css">
    
    <div id="root"> </div>
    <div id="popups"> </div>
    <div id="drawer"> </div>
        
    </body>
    
</html>`
    },
    {
        fileName: "<appname>.js",
        code: `//Force this app to portrait mode.
cfg.Portrait

//Main class for the app
class Main extends App
{
    //Called when app starts.
    onStart()
    {
        //Add main layout and set default child margins.
        this.layMain = ui.addLayout( "main", "linear", "fillxy,vcenter" )
        this.layMain.setChildMargins( .02, .02, .02, .02 )

        //Add some text.
        this.txt = ui.addText( this.layMain, "My Hybrid app")

        //Add a button with primary color.
        this.btn = ui.addButton( this.layMain, "My Button", "primary" )
        this.btn.setOnTouch( ()=>{ app.Vibrate( "0,100,30,100" ); } )
    }
}
        `
    }
];

var node = `// Configure app to use NodeJS as the main scripting engine
// giving you the full power of Node directly in your app!
cfg.Node

// Configure for Material UI and light theme.
cfg.MUI, cfg.Light

// Make sure the required node modules are installed to ide.
// (This downloads modules from https://www.npmjs.com).
ide.AddModule( "moment" )

// Called when application is started.
function OnStart()
{
    // Set MUI primary color.
    app.InitializeUIKit( MUI.colors.teal.teal, "Light" )

    // Use the NodeJS 'moment' module to format date.
    moment = require('moment')
    var text = moment().format() + "\\n"
     + moment().format("dddd, MMMM Do YYYY, h:mm:ss a") + "\\n"
     + moment().format("ddd, hA") + "\\n"
     + moment().format("[Today is] dddd") + "\\n"

    // Create a MUI card layout.
    lay = MUI.CreateLayout("Linear", "VCenter,FillXY")

    var options = { title: "Node Demo", body: text,
        buttonText: "SEE MORE", width: 0.94 }
    var card = MUI.CreateCard(options)
    card.SetOnButtonTouch( card_OnBtnTouch )
    lay.AddChild(card)

    // Add main layout to app.
    app.AddLayout(lay)
}

// Handle 'see more' button.
function card_OnBtnTouch(btnText, cardName)
{
    app.OpenUrl( "https://www.npmjs.com" )
}
`;

var html = `<html>
<head>
    <meta name="viewport" content="width=device-width">
    <script src='file:///android_asset/app.js'></script>
</head>
	
<script>
    //Called after application is started.
    function OnStart()
    {
        app.ShowPopup( "HTML Rocks!" );
    }
</script>

<style>
	body { background-color: #ffffff; }
    .hello 
    { 
        font-size: 42; 
        width: 100%;
        margin-top: 2em;
        text-align: center;
        color: blue;
    }
</style>

<body onload="app.Start()">

	<div class="hello"> Hello World! </div>
	
</body>
</html>
`;

module.exports = {
    native,
    mui,
    hybrid,
    node,
    html
}