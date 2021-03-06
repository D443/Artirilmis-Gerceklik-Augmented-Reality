// Created by Metaio_Creator_6.0.1_DEMO_MODE_2014-12-09T12:43:39

//arel.Debug.activate();

var methodExists = function (object, method) {
    return typeof object !== 'undefined' && typeof method === 'function';
};

arel.sceneReady(function() {

    var scenario = {};
    scenario.objectName = "scenario";
    scenario.contents = []; // Array of all contents in this AR scenario
    scenario.trackables = []; // Array of all trackables in this AR scenario
    scenario.scenes = []; // Array of all scenes in this AR scenario
    scenario.googleAnalytics = null;
    scenario.currentScene = null;
    scenario.currentExperience360 = null;
    scenario.instantTrackingMode = false; // True if instant tracking is currently running
    scenario.currentTrackingConfigPathOrIdentifier = "html/resources/TrackingConfig_f708de0168dbb6e9c94d2d58a3f19226.zip";

    scenario.addObject = function (object) {
        arel.Debug.log("scenario.addObject(" + object.objectName + ")");
        this.registerObject(object);
        arel.Scene.addObject(object);
    };

    scenario.registerObject = function (object) {
        arel.Debug.log("scenario.registerObject(" + object.objectName + ")");
        arel.Events.setListener(object, this.objectEventsCallback, scenario);
    };

    scenario.groupID = 0;
    scenario.getNewGroupID = function () {
        this.groupID++;
        return this.groupID;
    };

    scenario.getTrackable = function (identifier) {
        arel.Debug.log("scenario.getTrackable(" + identifier + ")");
        var i;
        var trackable = null;
        if (!identifier || identifier === "") {
            arel.Debug.log("scenario.getTrackable(): Warning - identifier is empty, returning null");
            return trackable;
        }
        var allTrackables = this.trackables;
        for (i = 0; i < allTrackables.length; ++i) {
            trackable = allTrackables[i];
            if (trackable.objectName == identifier) {
                return trackable;
            }
            if (trackable.cosName == identifier) {
                return trackable;
            }
            if (trackable.cosID == identifier) {
                return trackable;
            }
        }
        arel.Debug.log("scenario.getTrackable(" + identifier + "): Error - could not correlate the given identifier to any known trackable.");
        return null;
    };

    scenario.sceneCallback = function (type, result) {
        if (!type) {
            return;
        }
        switch (type) {
        case arel.Events.Scene.ONTRACKING:
            this.onTrackingChanged(result);
            break;
        case arel.Events.Scene.ONVISUALSEARCHRESULT:
            break;
        case arel.Events.Scene.ONREADY:
            break;
        case arel.Events.Scene.ONLOAD:
        case arel.Events.Scene.ONLOCATIONUPDATE:
        default:
            break;
        }
    };

    scenario.objectEventsCallback = function (object, type, params) {
        switch (type) {
        case arel.Events.Object.ONREADY:
            if (methodExists(object, object.onLoaded)) {
                object.onLoaded();
            }
            break;
        case arel.Events.Object.ONTOUCHSTARTED:
            if (this.googleAnalytics) {
                this.googleAnalytics.logUIInteraction(arel.Plugin.Analytics.Action.TOUCHSTARTED, object.getID());
            }
            break;
        case arel.Events.Object.ONTOUCHENDED:
            if (this.googleAnalytics) {
                this.googleAnalytics.logUIInteraction(arel.Plugin.Analytics.Action.TOUCHENDED, object.getID());
            }
            break;
        case arel.Events.Object.ONINVISIBLE:
        case arel.Events.Object.ONVISIBLE:
        case arel.Events.Object.ONANIMATIONENDED:
        case arel.Events.Object.ONMOVIEENDED:
        case arel.Events.Object.ONLOAD:
        case arel.Events.Object.ONROTATED:
        case arel.Events.Object.ONSCALED:
        case arel.Events.Object.ONTRANSLATED:
        default:
            break;
        }
    };

    scenario.onTrackingChanged = function (trackingValuesList) {
        if (trackingValuesList.length === 0) {
            arel.Debug.log("scenario.onTrackingChanged: Error - list of tracking values is empty, this should be impossible.");
            return;
        }
        var i, trackingValues, cosName, cosID, trackable, trackingMethod, gaTrackingMethod;
        for (i = 0; i < trackingValuesList.length; i++) {
            trackingValues = trackingValuesList[i];
            trackable = null;
            cosName = trackingValues.getCoordinateSystemName();
            cosID = trackingValues.getCoordinateSystemID();
            // Try to find the trackable by its COS name first. If that fails, try the COS ID.
            if (cosName && cosName !== "") {
                trackable = this.getTrackable(cosName);
            }
            if (trackable === null && cosID) {
                trackable = this.getTrackable(cosID);
            }
            if (trackable === null) {
                arel.Debug.log("onTrackingChanged: Error - Can't find a trackable matching COS name '" + cosName + "' or COS ID '" + cosID + "'");
                return;
            }
            else {
                // The cosID 1 is strictly reserved for the 360 experience if it is running.
                if (scenario.currentExperience360 && cosID === 1) {
                    return;
                }
            }

            switch (trackingValues.getState()) {
            case arel.Tracking.STATE_NOTTRACKING:
                arel.Debug.log("onTrackingChanged: " + trackable.objectName + " is not tracking");
                if (methodExists(trackable, trackable.onTrackingLost)) {
                    trackable.onTrackingLost(trackingValues);
                }
                break;
            case arel.Tracking.STATE_TRACKING:
                arel.Debug.log("onTrackingChanged: " + trackable.objectName + " is tracking");
                if (methodExists(trackable, trackable.onDetected)) {
                    trackable.onDetected();
                }
                if (methodExists(trackable, trackable.onTracked)) {
                    trackable.onTracked(trackingValues);
                }
                if (this.googleAnalytics) {
                    trackingMethod  = trackingValues.getType();
                    gaTrackingMethod = this.googleAnalytics.trackingTypeToAnalyticsType(trackingMethod);
                    this.googleAnalytics.logTrackingEvent(gaTrackingMethod, arel.Plugin.Analytics.Action.STATE_TRACKING, cosID, cosName);
                }
                break;
            case arel.Tracking.STATE_EXTRAPOLATED:
            case arel.Tracking.STATE_INITIALIZED:
            case arel.Tracking.STATE_REGISTERED:
            default:
                break;
            }
        }
    };


    scenario.startInstantTracking = function () {
        arel.Debug.log("scenario.startInstantTracking()");
        if (this.instantTrackingMode) {
            return;
        }
        this.instantTrackingMode = true;

        if (scenario.currentExperience360) {
            scenario.currentExperience360.hide();
        }

        // Iterate over all trackables, simulate an onTrackingLost() for all those which are currently tracking.
        var i, trackable;
        for (i = 0; i < this.trackables.length; ++i) {
            trackable = this.trackables[i];
            if (trackable.isCurrentlyTracking && trackable != userDevice) {
                if (methodExists(trackable, trackable.onTrackingLost)) {
                    trackable.onTrackingLost();
                }
            }
        }
        arel.Scene.startInstantTracking(arel.Tracking.INSTANT2D);

        if (methodExists(this, this.onStartInstantTracking)) {
            this.onStartInstantTracking();
        }
    };

    scenario.stopInstantTracking = function () {
        arel.Debug.log("scenario.stopInstantTracking()");
        if (!this.instantTrackingMode) {
            return;
        }

        this.instantTrackingMode = false;

        if (methodExists(instantTracker, instantTracker.onTrackingLost)) {
            instantTracker.onTrackingLost();
        }

        this.setTrackingConfiguration(this.currentTrackingConfigPathOrIdentifier);

        if (methodExists(this, this.onStopInstantTracking)) {
            this.onStopInstantTracking();
        }
    };

    scenario.reloadTrackingConfiguration = function () {
        arel.Debug.log("scenario.reloadTrackingConfiguration()");
        this.setTrackingConfiguration(this.currentTrackingConfigPathOrIdentifier);
        if (methodExists(this, this.onReloadTrackingConfiguration)) {
            this.onReloadTrackingConfiguration();
        }
    };

    scenario.setTrackingConfiguration = function (trackingConfigPathOrIdentifier) {
        // Iterate over all trackables, simulate an onTrackingLost() for all those which are currently tracking.
        var i, trackable;
        for (i = 0; i < this.trackables.length; ++i) {
            trackable = this.trackables[i];
            if (trackable.isCurrentlyTracking && trackable != userDevice) {
                if (methodExists(trackable, trackable.onTrackingLost)) {
                    trackable.onTrackingLost();
                }
            }
        }

        // Set the new tracking configuration.
        arel.Scene.setTrackingConfiguration(trackingConfigPathOrIdentifier);
    };

    scenario.saveScreenshot = function(canvas) {
        arel.Debug.log("scenario.saveScreenshot()");

        // Retrieve the new image's data as base64 encoded jpeg (string).
        // The returned string will have the following format: data:image/jpeg;base64,/9j/4AAQS...
        var imageData = canvas.toDataURL("image/jpeg", 1.0);

        var image = new arel.Image(imageData);
        arel.Scene.shareImage(image, true);
    };

    scenario.createScreenshotCanvas = function(image, displayScreenshot, displayCommentBox) {
        arel.Debug.log("scenario.createScreenshotCanvas()");

        // Create a canvas with same size as the given image.
        var canvas = document.createElement("canvas");
        var canvasStyle = "width:100%; height:100%; margin:0px; padding:0px; position:relative;";
        canvas.setAttribute("id", "canvas");
        canvas.setAttribute("width", image.getWidth());
        canvas.setAttribute("height", image.getHeight());
        canvas.setAttribute("style", canvasStyle);

        var canvasDiv = document.createElement("canvasDiv");
        var canvasDivStyle = "width:100%; height:100%; margin:0px; padding:0px; position:absolute;display: inline-block; vertical-align:top; z-index=1;";
        canvasDiv.setAttribute("id", "canvasDiv");
        canvasDiv.setAttribute("style", canvasDivStyle);
        canvasDiv.appendChild(canvas);

        // Show the screenshot if it has been requested.
        if (displayScreenshot) {
            document.body.appendChild(canvasDiv);
        }

        // Create new image to which the text should be added.
        var imageToLoad = new Image();

        // We define here the onerror callback function, called if an error occurred while loading the given image.
        imageToLoad.onerror = function() {
            arel.Debug.log("scenario.createScreenshotCanvas() - an error occurred while loading the screenshot image.");
        };

        // We define here the onload callback function, called when the given image has been loaded successfully.
        imageToLoad.onload = function() {
            arel.Debug.log("scenario.createScreenshotCanvas() - the screenshot image has been loaded successfully.");

            // Retrieve canvas's context.
            var context = canvas.getContext("2d");

            // Draw the given image in the canvas.
            context.drawImage(imageToLoad, 0, 0);

            if (displayCommentBox) {
                scenario.addCommentToScreenshot(canvas, imageToLoad);
            }
            else {
                scenario.saveScreenshot(canvas);
            }
        };

        // Load the given image. The arel.Image's buffer does not contain the prefix "data:image/jpeg;base64,".
        imageToLoad.src = "data:image/jpeg;base64,"+image.getImageBuffer();
    };

    scenario.wrapText = function(context, text, x, y, maxWidth, lineHeight) {
        var words = text.split(" ");
        var line = "";
        for (var n = 0; n < words.length; n++) {
            var testLine = line + words[n] + " ";
            var metrics = context.measureText(testLine);
            var testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                context.fillText(line, x, y);
                line = words[n] + " ";
                y += lineHeight;
            }
            else {
                line = testLine;
            }
        }
        context.fillText(line, x, y);
    };

    scenario.renderCanvasComment = function(canvas, image, comment) {
        var context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        context.font = comment.fontStyle + " " + comment.fontVariant + " " + comment.fontWeight + " " + comment.fontSize + " " + comment.fontFamily;
        context.fillStyle = comment.fillStyle;
        context.textAlign = comment.align;
        context.shadowColor = comment.shadowColor;
        context.shadowOffsetX = comment.shadowOffsetX;
        context.shadowOffsetY = comment.shadowOffsetY;
        context.shadowBlur = comment.shadowBlur;
        scenario.wrapText(context, comment.text, comment.xOffset, comment.yOffset, comment.maxWidth, comment.lineHeight);
    };

    scenario.addCommentToScreenshot = function(canvas, image) {
        arel.Debug.log("scenario.addCommentToScreenshot()");

        // Define comment object to use later on.
        var comment = {};
        comment.text = "";
        comment.maxlength = 160;
        comment.length = 0;
        comment.maxWidth = canvas.width/2;
        comment.lineHeight = 25;
        comment.xOffset = canvas.width/2;
        comment.yOffset = canvas.height-(comment.lineHeight*4);
        comment.fontStyle = "normal";
        comment.fontVariant = "normal";
        comment.fontWeight = "normal";
        comment.fontSize = "20pt";
        comment.fontFamily = "sans-serif";
        comment.fillStyle = "white";
        comment.align = "center";
        comment.shadowColor = "black";
        comment.shadowOffsetX = -2.5;
        comment.shadowOffsetY = 0;
        comment.shadowBlur = 5;

        var styleCSS = document.createElement("style");
        styleCSS.setAttribute("id", "commentStyleCSS");
        styleCSS.setAttribute("type", "text/css");
        styleCSS.appendChild(document.createTextNode("@media screen and (orientation:portrait) { #commentDiv{margin-bottom:20px;} #commentLabelDiv{float:left;} #commentTextAreaDiv{float:left;} #commentButtonsDiv{float:right;} }"));
        document.head.appendChild(styleCSS);

        // Create and setup comment label's div html element.
        var labelDiv = document.createElement("div");
        var labelDivStyle = "width:auto; height:auto; margin:0px; padding:0px; position:relative; text-align: right; display: inline-block; vertical-align:top;";
        labelDiv.setAttribute("id", "commentLabelDiv");
        labelDiv.setAttribute("style", labelDivStyle);
        labelDiv.appendChild(document.createTextNode("Comment:"));

        // Create comment's text area html element.
        var textArea = document.createElement("textarea");
        textArea.setAttribute("id", "commentTextArea");
        textArea.setAttribute("name", "commentTextArea");
        textArea.setAttribute("cols", "40");
        textArea.setAttribute("rows", "4");
        textArea.setAttribute("maxlength", comment.maxlength);
        textArea.setAttribute("style", "-webkit-user-select:auto; background-color:#fefefe;");
        textArea.addEventListener("input", function() {comment.text = textArea.value; comment.length = textArea.value.length; counterDiv.innerHTML = comment.maxlength-comment.length; scenario.renderCanvasComment(canvas,image,comment);}, false);

        // Create and setup comment's counter div html element.
        var counterDiv = document.createElement("div");
        var counterDivStyle = "text-align:left; vertical-align:bottom; width:auto; height:auto; margin:0px; padding:0px; position:relative;";
        counterDiv.setAttribute("id", "commentCounterDiv");
        counterDiv.setAttribute("style", counterDivStyle);
        counterDiv.innerHTML = comment.maxlength-comment.length;

        // Create and setup comment text area's div html element.
        var textAreaDiv = document.createElement("div");
        var textAreaDivStyle = "width:auto; height:auto; margin:0px; padding:0px; position:relative; display: inline-block; vertical-align:top;";
        textAreaDiv.setAttribute("id", "commentTextAreaDiv");
        textAreaDiv.setAttribute("style", textAreaDivStyle);
        textAreaDiv.appendChild(textArea);
        textAreaDiv.appendChild(counterDiv);

        // Create comment's submit button html element.
        var submitButton = document.createElement("input");
        var submitButtonStyle = "vertical-align:top";
        submitButton.setAttribute("id", "commentSubmitButton");
        submitButton.setAttribute("type", "button");
        submitButton.setAttribute("value", "Save screenshot");
        submitButton.setAttribute("style", submitButtonStyle);
        submitButton.addEventListener("click",function(){scenario.commentSubmitted(canvas);},false);

        // Create comment's cancel button html element.
        var cancelButton = document.createElement("input");
        var cancelButtonStyle = "vertical-align:top";
        cancelButton.setAttribute("id", "commentCancelButton");
        cancelButton.setAttribute("type", "button");
        cancelButton.setAttribute("value", "Cancel");
        cancelButton.setAttribute("style", cancelButtonStyle);
        cancelButton.addEventListener("click",scenario.commentCanceled,false);

        // Create and setup comment buttons' div html element.
        var buttonsDiv = document.createElement("div");
        var buttonsDivStyle = "width:auto; height:auto; margin:0px; padding:0px; position:relative; display: inline-block; vertical-align:top;";
        buttonsDiv.setAttribute("id", "commentButtonsDiv");
        buttonsDiv.setAttribute("style", buttonsDivStyle);
        buttonsDiv.appendChild(submitButton);
        buttonsDiv.appendChild(cancelButton);

        // Create and setup comment's form html element.
        var form = document.createElement("form");
        form.setAttribute("id", "commentForm");
        form.appendChild(labelDiv);
        form.appendChild(textAreaDiv);
        form.appendChild(buttonsDiv);

        // Create and setup comment's div html element.
        var commentDiv = document.createElement("div");
        var commentDivStyle = "margin-top: 20px; margin-bottom: 5px; margin-left: 30px; margin-right: 30px; position:relative; display: inline-block; width:auto; height:auto;";
        commentDiv.setAttribute("id", "commentDiv");
        commentDiv.setAttribute("style", commentDivStyle);
        commentDiv.appendChild(form);

        // Create and setup main comment's div html element.
        var commentMainDiv = document.createElement("div");
        var commentMainDivStyle = "color:white; font: bold 16px/18px Helvetica, Arial, Sans-serif; margin:0px; padding:0px; position:absolute; width:100%; height:auto; background-color:#333; -webkit-box-shadow:2px 2px 4px #666; opacity:0.8; text-align:center; z-index=2;";
        commentMainDiv.setAttribute("id", "commentMainDiv");
        commentMainDiv.setAttribute("style", commentMainDivStyle);
        commentMainDiv.appendChild(commentDiv);

        // Append the div element to the document's body.
        document.body.appendChild(commentMainDiv);
    };

    scenario.removeCanvas = function() {
        arel.Debug.log("scenario.removeScreenshot()");
        document.body.removeChild(document.getElementById("canvasDiv"));
    };

    scenario.removeComment = function() {
        arel.Debug.log("scenario.removeComment()");
        document.head.removeChild(document.getElementById("commentStyleCSS"));
        document.body.removeChild(document.getElementById("commentMainDiv"));
    };

    scenario.commentSubmitted = function(canvas) {
        arel.Debug.log("scenario.commentSubmitted()");

        // Remove any canvas HTLM element previously created.
        scenario.removeCanvas();

        // Remove any comment HTLM element previously created.
        scenario.removeComment();

        // Save screenshot with the given comment.
        scenario.saveScreenshot(canvas);
    };

    scenario.commentCanceled = function() {
        arel.Debug.log("scenario.commentCanceled()");

        // Remove any canvas HTLM element previously created.
        scenario.removeCanvas();

        // Remove any comment HTLM element previously created.
        scenario.removeComment();
    };

    scenario.takeScreenshot = function (displayCommentBox) {
        arel.Debug.log("scenario.takeScreenshot()");
        if (displayCommentBox) {
            arel.Scene.getScreenshot(function(image){scenario.createScreenshotCanvas(image, true, true);}, true, new arel.Vector2D(640, 480));
        }
        else {
            arel.Scene.getScreenshot(function(image){arel.Scene.shareImage(image, true);}, true, new arel.Vector2D(640, 480));
        }
    };

    scenario.onStartup = function () {
        arel.Debug.log("Welcome to the '1-0 Introduction Play Movie' Augmented Reality experience.");

        arel.Events.setListener(arel.Scene, scenario.sceneCallback, scenario);

        if (google_analytics_id) {
            arel.Debug.log("Google Analytics is enabled. Your account ID is: " + google_analytics_id);
            arel.Debug.log("The event sampling rate is: arel.Plugin.Analytics.EventSampling.ONCE");
            scenario.googleAnalytics = new arel.Plugin.Analytics(google_analytics_id, arel.Plugin.Analytics.EventSampling.ONCE, "");
        } else {
            arel.Debug.log("Note: No Google Analytics ID is set - Google Analytics will be disabled.");
        }

        if (methodExists(scenario, scenario.onLoaded)) {
            scenario.onLoaded();
        }

        // The following contents have been defined in the index.xml file, therefore we need to register them
        // and call their onLoaded() event manually.
        scenario.registerObject(button1);
        if (methodExists(button1, button1.onLoaded)) {
            button1.onLoaded();
        }
        scenario.registerObject(button2);
        if (methodExists(button2, button2.onLoaded)) {
            button2.onLoaded();
        }
        scenario.registerObject(video1);
        if (methodExists(video1, video1.onLoaded)) {
            video1.onLoaded();
        }
        scenario.registerObject(model3);
        if (methodExists(model3, model3.onLoaded)) {
            model3.onLoaded();
        }
        scenario.registerObject(image4);
        if (methodExists(image4, image4.onLoaded)) {
            image4.onLoaded();
        }


        if (methodExists(userDevice, userDevice.onLoaded)) {
            userDevice.onLoaded();
        }

        // All objects have been defined, so start the AR experience by calling each trackable's .onLoaded() method.
        var i, trackable;
        for (i = 0; i < scenario.trackables.length; ++i) {
            trackable = scenario.trackables[i];
            if (methodExists(trackable, trackable.onLoaded)) {
                trackable.onLoaded();
            }
        }

        // Call the first scene's display() once to make sure that the content of that scene is initially visible.
        scene1.display();
    };

    scenario.onLoaded = function () {
        arel.Debug.log(this.objectName + ".onLoaded()");
        /**** Begin of custom script ****/
        
           	showPlayButton(false);
           	showPauseButton(false);
        
        /***** End of custom script *****/
    };


    var scene1 = {};
    scenario.scenes.push(scene1);
    scene1.objectName = "scene1";

    scene1.display = function () {
        arel.Debug.log(this.objectName + ".display()");

        if (scenario.currentScene == this) {
            return;
        }

        // Iterate over all trackables, simulate an onTrackingLost() for all those which are currently tracking.
        var trackingTrackables = [];
        var i, trackable;
        for (i = 0; i < scenario.trackables.length; ++i) {
            trackable = scenario.trackables[i];
            if (trackable.isCurrentlyTracking) {
                // The instant tracker should be excluded from the tracking ones because it will be stopped later on.
                if (trackable !== instantTracker) {
                    trackingTrackables.push(trackable);
                }
                if (methodExists(trackable, trackable.onTrackingLost)) {
                    trackable.onTrackingLost();
                }
            }
        }

        // In case any instant tracking is currently running, stop it before switching to the other scene.
        scenario.stopInstantTracking();

        var previousExperience360 = null;
        if (scenario.currentExperience360) {
            previousExperience360 = scenario.currentExperience360;
            scenario.currentExperience360.hide();
        }

        scenario.currentScene = this;

        // Iterate over all tracking trackables again, this time simulating an onDetected() and onTracked() event
        // for all those which are currently tracking.
        for (i = 0; i < trackingTrackables.length; ++i) {
            trackable = trackingTrackables[i];
            if (methodExists(trackable, trackable.onDetected)) {
                trackable.onDetected();
            }
            if (methodExists(trackable, trackable.onTracked)) {
                trackable.onTracked(trackable.currentTrackingValues);
            }
        }

        if (previousExperience360) {
            // A 360 was displayed in the previous scene, we now need to check whether any 360 in the new scene
            // is triggered by the same trackable. If so, that 360 should be displayed.
            var content;
            for (i = 0; i < scenario.contents.length; ++i) {
                content = scenario.contents[i];
                if (content.type == "Experience360" && content.scene == this && 
                    content.associatedTrackable == previousExperience360.associatedTrackable) {
                    content.display();
                    break;
                }
            }
        }

        if (methodExists(this, this.onDisplayed)) {
            this.onDisplayed();
        }
    };


    var instantTracker = {};
    scenario.trackables.push(instantTracker);
    instantTracker.objectName = "instantTracker";
    instantTracker.cosName = "InstantTracker";
    instantTracker.cosID = "1";
    instantTracker.isCurrentlyTracking = false;
    instantTracker.currentTrackingValues = null;
    instantTracker.onTracked = function (trackingValues) {
        arel.Debug.log(this.objectName + ".onTracked()");
        this.isCurrentlyTracking = true;
        this.currentTrackingValues = trackingValues;
    };

    instantTracker.onTrackingLost = function (trackingValues) {
        arel.Debug.log(this.objectName + ".onTrackingLost()");
        this.isCurrentlyTracking = false;
        this.currentTrackingValues = null;
    };


    var pattern1 = {};
    scenario.trackables.push(pattern1);
    pattern1.objectName = "pattern1";
    pattern1.cosName = "Muzik_3345714_1";
    pattern1.cosID = "1";
    pattern1.isCurrentlyTracking = false;
    pattern1.currentTrackingValues = null;
    pattern1.onTracked = function (trackingValues) {
        arel.Debug.log(this.objectName + ".onTracked()");
        this.isCurrentlyTracking = true;
        this.currentTrackingValues = trackingValues;
        button1.display();
        button2.display();
        video1.display();
        video1.play();
    };

    pattern1.onTrackingLost = function (trackingValues) {
        arel.Debug.log(this.objectName + ".onTrackingLost()");
        this.isCurrentlyTracking = false;
        this.currentTrackingValues = null;
        video1.pause();
        button1.hide();
        button2.hide();
        video1.hide();
    };


    var pattern3 = {};
    scenario.trackables.push(pattern3);
    pattern3.objectName = "pattern3";
    pattern3.cosName = "2015-03-19 10-47-14 20150319_104331.jpg - Windows Fotoğraf Görüntüleyicisi_2";
    pattern3.cosID = "2";
    pattern3.isCurrentlyTracking = false;
    pattern3.currentTrackingValues = null;
    pattern3.onTracked = function (trackingValues) {
        arel.Debug.log(this.objectName + ".onTracked()");
        this.isCurrentlyTracking = true;
        this.currentTrackingValues = trackingValues;
        model3.display();
        model3.play("New Animation 2", false);
    };

    pattern3.onTrackingLost = function (trackingValues) {
        arel.Debug.log(this.objectName + ".onTrackingLost()");
        this.isCurrentlyTracking = false;
        this.currentTrackingValues = null;
        model3.hide();
    };


    var userDevice = {};
    userDevice.isCurrentlyTracking = true; // The pose of the user's device is always tracked...
    scenario.trackables.push(userDevice);
    userDevice.objectName = "userDevice";
    userDevice.cosName = "Device";
    userDevice.cosID = "-1";
    userDevice.onTracked = function (trackingValues) {
        arel.Debug.log(this.objectName + ".onTracked()");
        this.isCurrentlyTracking = true;
        this.currentTrackingValues = trackingValues;
        image4.display();
    };

    userDevice.onTrackingLost = function (trackingValues) {
        arel.Debug.log(this.objectName + ".onTrackingLost()");
        this.isCurrentlyTracking = false;
        this.currentTrackingValues = null;
        image4.hide();
    };


    if (!arel.Scene.objectExists("button1")) {
        arel.Debug.log("ERROR: retrieving the object button1, it seems that it does not exist. Maybe it would help cleaning the cache or a problem occurred while reloading the channel.");
    }

    var button1 = arel.Scene.getObject("button1");
    button1.objectName = "button1";
    button1.type = "Button";
    button1.scene = scene1;
    button1.associatedTrackable = pattern1;
    button1.displayOnLoaded = false;
    scenario.contents.push(button1);

    button1.setScene = function (scene) {
        this.scene = scene;
        scenario.currentScene.display();
    };

    button1.isLoaded = function () {
        return arel.Scene.objectExists("button1");
    };

    button1.bind = function (cosID) {
        arel.Debug.log(this.objectName + ".bind(" + cosID + ")");
        this.setCoordinateSystemID(cosID);
    };

    button1.load = function () {
        arel.Debug.log(this.objectName + ".load()");
        if (!this.isLoaded()) {
            scenario.addObject(this);
        }
    };

    button1.unload = function () {
        arel.Debug.log(this.objectName + ".unload()");
        if (this.isLoaded()) {
            arel.Scene.removeObject(this);
            if (methodExists(this, this.onUnloaded)) {
                this.onUnloaded();
            }
        }
    };

    button1.display = function () {
        arel.Debug.log(this.objectName + ".display()");
        if (this.scene && this.scene != scenario.currentScene) {
            return;
        }
        
        if (!this.isLoaded()) {
            this.displayOnLoaded = true;
            this.load();
            return;
        }
        
        this.setVisibility(true);
    };

    button1.hide = function () {
        arel.Debug.log(this.objectName + ".hide()");
        this.setVisibility(false);
    };

    button1.attach = function (origin, offset) {
        arel.Debug.log(this.objectName + ".attach(" + origin.objectName + ")");
        if (typeof (origin.getScreenAnchor()) != 'undefined' && typeof (origin.getScreenAnchorFlags()) != 'undefined') {
            this.setScreenAnchor(origin.getScreenAnchor(), origin.getScreenAnchorFlags());
        }
        this.setTranslation(arel.Vector3D.add(origin.getTranslation(), offset));
        if (origin.groupID) {
            if (this.groupID) {
                arel.GestureHandler.removeObject(button1);
            }
            arel.GestureHandler.addObject("button1", origin.groupID);
            this.setPickingEnabled(false);
        }
    };

    button1.play = function (animationName, animationLooped) {
        arel.Debug.log(this.objectName + ".play(" + animationName + ", " + animationLooped + ")");
        this.startAnimation(animationName, animationLooped);
        if (methodExists(this, this.onPlayed)) {
            this.onPlayed(animationName);
        }
    };

    button1.onTouchStarted = function () {
        arel.Debug.log(this.objectName + ".onTouchStarted()");
        /**** Begin of custom script ****/
        
        	// AR objects are already put into JavaScript Objects by Creator --> video1
        	// start the video:
        	video1.play();
        
        /***** End of custom script *****/
    };

    button1.onLoaded = function () {
        arel.Debug.log(this.objectName + ".onLoaded()");
        this.hide();
        if (this.displayOnLoaded) { 
            this.displayOnLoaded = false;
            this.display();
        }
        if (this.playOnLoaded) { 
            this.playOnLoaded = false;
            this.play();
        }
    };


    if (!arel.Scene.objectExists("button2")) {
        arel.Debug.log("ERROR: retrieving the object button2, it seems that it does not exist. Maybe it would help cleaning the cache or a problem occurred while reloading the channel.");
    }

    var button2 = arel.Scene.getObject("button2");
    button2.objectName = "button2";
    button2.type = "Button";
    button2.scene = scene1;
    button2.associatedTrackable = pattern1;
    button2.displayOnLoaded = false;
    scenario.contents.push(button2);

    button2.setScene = function (scene) {
        this.scene = scene;
        scenario.currentScene.display();
    };

    button2.isLoaded = function () {
        return arel.Scene.objectExists("button2");
    };

    button2.bind = function (cosID) {
        arel.Debug.log(this.objectName + ".bind(" + cosID + ")");
        this.setCoordinateSystemID(cosID);
    };

    button2.load = function () {
        arel.Debug.log(this.objectName + ".load()");
        if (!this.isLoaded()) {
            scenario.addObject(this);
        }
    };

    button2.unload = function () {
        arel.Debug.log(this.objectName + ".unload()");
        if (this.isLoaded()) {
            arel.Scene.removeObject(this);
            if (methodExists(this, this.onUnloaded)) {
                this.onUnloaded();
            }
        }
    };

    button2.display = function () {
        arel.Debug.log(this.objectName + ".display()");
        if (this.scene && this.scene != scenario.currentScene) {
            return;
        }
        
        if (!this.isLoaded()) {
            this.displayOnLoaded = true;
            this.load();
            return;
        }
        
        this.setVisibility(true);
    };

    button2.hide = function () {
        arel.Debug.log(this.objectName + ".hide()");
        this.setVisibility(false);
    };

    button2.attach = function (origin, offset) {
        arel.Debug.log(this.objectName + ".attach(" + origin.objectName + ")");
        if (typeof (origin.getScreenAnchor()) != 'undefined' && typeof (origin.getScreenAnchorFlags()) != 'undefined') {
            this.setScreenAnchor(origin.getScreenAnchor(), origin.getScreenAnchorFlags());
        }
        this.setTranslation(arel.Vector3D.add(origin.getTranslation(), offset));
        if (origin.groupID) {
            if (this.groupID) {
                arel.GestureHandler.removeObject(button2);
            }
            arel.GestureHandler.addObject("button2", origin.groupID);
            this.setPickingEnabled(false);
        }
    };

    button2.play = function (animationName, animationLooped) {
        arel.Debug.log(this.objectName + ".play(" + animationName + ", " + animationLooped + ")");
        this.startAnimation(animationName, animationLooped);
        if (methodExists(this, this.onPlayed)) {
            this.onPlayed(animationName);
        }
    };

    button2.onTouchStarted = function () {
        arel.Debug.log(this.objectName + ".onTouchStarted()");
        /**** Begin of custom script ****/
        
        	// pause the video:
           	video1.pause();
        
        /***** End of custom script *****/
    };

    button2.onLoaded = function () {
        arel.Debug.log(this.objectName + ".onLoaded()");
        this.hide();
        if (this.displayOnLoaded) { 
            this.displayOnLoaded = false;
            this.display();
        }
        if (this.playOnLoaded) { 
            this.playOnLoaded = false;
            this.play();
        }
    };


    // logo
    if (!arel.Scene.objectExists("image4")) {
        arel.Debug.log("ERROR: retrieving the object image4, it seems that it does not exist. Maybe it would help cleaning the cache or a problem occurred while reloading the channel.");
    }

    var image4 = arel.Scene.getObject("image4");
    image4.objectName = "image4";
    image4.type = "Image";
    image4.scene = scene1;
    image4.associatedTrackable = userDevice;
    image4.displayOnLoaded = false;
    scenario.contents.push(image4);

    image4.setScene = function (scene) {
        this.scene = scene;
        scenario.currentScene.display();
    };

    image4.isLoaded = function () {
        return arel.Scene.objectExists("image4");
    };

    image4.bind = function (cosID) {
        arel.Debug.log(this.objectName + ".bind(" + cosID + ")");
        this.setCoordinateSystemID(cosID);
    };

    image4.load = function () {
        arel.Debug.log(this.objectName + ".load()");
        if (!this.isLoaded()) {
            scenario.addObject(this);
        }
    };

    image4.unload = function () {
        arel.Debug.log(this.objectName + ".unload()");
        if (this.isLoaded()) {
            arel.Scene.removeObject(this);
            if (methodExists(this, this.onUnloaded)) {
                this.onUnloaded();
            }
        }
    };

    image4.display = function () {
        arel.Debug.log(this.objectName + ".display()");
        if (this.scene && this.scene != scenario.currentScene) {
            return;
        }
        
        if (!this.isLoaded()) {
            this.displayOnLoaded = true;
            this.load();
            return;
        }
        
        this.setVisibility(true);
    };

    image4.hide = function () {
        arel.Debug.log(this.objectName + ".hide()");
        this.setVisibility(false);
    };

    image4.attach = function (origin, offset) {
        arel.Debug.log(this.objectName + ".attach(" + origin.objectName + ")");
        if (typeof (origin.getScreenAnchor()) != 'undefined' && typeof (origin.getScreenAnchorFlags()) != 'undefined') {
            this.setScreenAnchor(origin.getScreenAnchor(), origin.getScreenAnchorFlags());
        }
        this.setTranslation(arel.Vector3D.add(origin.getTranslation(), offset));
        if (origin.groupID) {
            if (this.groupID) {
                arel.GestureHandler.removeObject(image4);
            }
            arel.GestureHandler.addObject("image4", origin.groupID);
            this.setPickingEnabled(false);
        }
    };

    image4.play = function (animationName, animationLooped) {
        arel.Debug.log(this.objectName + ".play(" + animationName + ", " + animationLooped + ")");
        this.startAnimation(animationName, animationLooped);
        if (methodExists(this, this.onPlayed)) {
            this.onPlayed(animationName);
        }
    };

    image4.onLoaded = function () {
        arel.Debug.log(this.objectName + ".onLoaded()");
        this.hide();
        if (this.displayOnLoaded) { 
            this.displayOnLoaded = false;
            this.display();
        }
        if (this.playOnLoaded) { 
            this.playOnLoaded = false;
            this.play();
        }
    };


    // Mammut
    if (!arel.Scene.objectExists("model3")) {
        arel.Debug.log("ERROR: retrieving the object model3, it seems that it does not exist. Maybe it would help cleaning the cache or a problem occurred while reloading the channel.");
    }

    var model3 = arel.Scene.getObject("model3");
    model3.objectName = "model3";
    model3.type = "Model";
    model3.scene = scene1;
    model3.associatedTrackable = pattern3;
    model3.displayOnLoaded = false;
    scenario.contents.push(model3);
    model3.groupID = scenario.getNewGroupID();

    model3.setScene = function (scene) {
        this.scene = scene;
        scenario.currentScene.display();
    };

    model3.isLoaded = function () {
        return arel.Scene.objectExists("model3");
    };

    model3.bind = function (cosID) {
        arel.Debug.log(this.objectName + ".bind(" + cosID + ")");
        this.setCoordinateSystemID(cosID);
    };

    model3.load = function () {
        arel.Debug.log(this.objectName + ".load()");
        if (!this.isLoaded()) {
            scenario.addObject(this);
        }
    };

    model3.unload = function () {
        arel.Debug.log(this.objectName + ".unload()");
        if (this.isLoaded()) {
            arel.Scene.removeObject(this);
            if (methodExists(this, this.onUnloaded)) {
                this.onUnloaded();
            }
        }
    };

    model3.display = function () {
        arel.Debug.log(this.objectName + ".display()");
        if (this.scene && this.scene != scenario.currentScene) {
            return;
        }
        
        if (!this.isLoaded()) {
            this.displayOnLoaded = true;
            this.load();
            return;
        }
        
        this.setVisibility(true);
    };

    model3.hide = function () {
        arel.Debug.log(this.objectName + ".hide()");
        this.setVisibility(false);
    };

    model3.attach = function (origin, offset) {
        arel.Debug.log(this.objectName + ".attach(" + origin.objectName + ")");
        if (typeof (origin.getScreenAnchor()) != 'undefined' && typeof (origin.getScreenAnchorFlags()) != 'undefined') {
            this.setScreenAnchor(origin.getScreenAnchor(), origin.getScreenAnchorFlags());
        }
        this.setTranslation(arel.Vector3D.add(origin.getTranslation(), offset));
        if (origin.groupID) {
            if (this.groupID) {
                arel.GestureHandler.removeObject(model3);
            }
            arel.GestureHandler.addObject("model3", origin.groupID);
            this.setPickingEnabled(false);
        }
    };

    model3.play = function (animationName, animationLooped) {
        arel.Debug.log(this.objectName + ".play(" + animationName + ", " + animationLooped + ")");
        this.startAnimation(animationName, animationLooped);
        if (methodExists(this, this.onPlayed)) {
            this.onPlayed(animationName);
        }
    };

    model3.onLoaded = function () {
        arel.Debug.log(this.objectName + ".onLoaded()");
        arel.GestureHandler.addObject("model3", model3.groupID);
        this.hide();
        if (this.displayOnLoaded) { 
            this.displayOnLoaded = false;
            this.display();
        }
        if (this.playOnLoaded) { 
            this.playOnLoaded = false;
            this.play();
        }
        this.play("New Animation 2", false);
    };


    // Indila - Thug Mariage (Solo)
    if (!arel.Scene.objectExists("video1")) {
        arel.Debug.log("ERROR: retrieving the object video1, it seems that it does not exist. Maybe it would help cleaning the cache or a problem occurred while reloading the channel.");
    }

    var video1 = arel.Scene.getObject("video1");
    video1.objectName = "video1";
    video1.type = "InPageVideo";
    video1.scene = scene1;
    video1.associatedTrackable = pattern1;
    video1.displayOnLoaded = false;
    video1.playOnLoaded = false;
    scenario.contents.push(video1);

    video1.setScene = function (scene) {
        this.scene = scene;
        scenario.currentScene.display();
    };

    video1.isLoaded = function () {
        return arel.Scene.objectExists("video1");
    };

    video1.bind = function (cosID) {
        arel.Debug.log(this.objectName + ".bind(" + cosID + ")");
        this.setCoordinateSystemID(cosID);
    };

    video1.load = function () {
        arel.Debug.log(this.objectName + ".load()");
        if (!this.isLoaded()) {
            scenario.addObject(this);
        }
    };

    video1.unload = function () {
        arel.Debug.log(this.objectName + ".unload()");
        if (this.isLoaded()) {
            arel.Scene.removeObject(this);
            if (methodExists(this, this.onUnloaded)) {
                this.onUnloaded();
            }
        }
    };

    video1.display = function () {
        arel.Debug.log(this.objectName + ".display()");
        if (this.scene && this.scene != scenario.currentScene) {
            return;
        }
        
        if (!this.isLoaded()) {
            this.displayOnLoaded = true;
            this.load();
            return;
        }
        
        this.setVisibility(true);
    };

    video1.hide = function () {
        arel.Debug.log(this.objectName + ".hide()");
        this.setVisibility(false);
    };

    video1.attach = function (origin, offset) {
        arel.Debug.log(this.objectName + ".attach(" + origin.objectName + ")");
        if (typeof (origin.getScreenAnchor()) != 'undefined' && typeof (origin.getScreenAnchorFlags()) != 'undefined') {
            this.setScreenAnchor(origin.getScreenAnchor(), origin.getScreenAnchorFlags());
        }
        this.setTranslation(arel.Vector3D.add(origin.getTranslation(), offset));
        if (origin.groupID) {
            if (this.groupID) {
                arel.GestureHandler.removeObject(video1);
            }
            arel.GestureHandler.addObject("video1", origin.groupID);
            this.setPickingEnabled(false);
        }
    };

    video1.play = function () {
        arel.Debug.log(this.objectName + ".play()");
        if (this.scene && this.scene != scenario.currentScene) {
            return;
        }
        if (!this.isLoaded()) {
            this.playOnLoaded = true;
            this.load();
            return;
        }
        this.startMovieTexture(true);
        if (scenario.googleAnalytics) {
            scenario.googleAnalytics.logVideo("Indila - Thug Mariage (Solo)");
        }
        if (methodExists(this, this.onPlayed)) {
            this.onPlayed();
        }
    };

    video1.pause = function () {
        arel.Debug.log(this.objectName + ".pause()");
        this.pauseMovieTexture();
        if (methodExists(this, this.onPaused)) {
            this.onPaused();
        }
    };

    video1.stop = function () {
        arel.Debug.log(this.objectName + ".stop()");
        this.stopMovieTexture();
    };

    video1.onPlayed = function () {
        arel.Debug.log(this.objectName + ".onPlayed()");
        /**** Begin of custom script ****/
        
        	showPlayButton(false); // hide playbutton
            showPauseButton(true); // show pausebutton
        
        /***** End of custom script *****/
    };

    video1.onPaused = function () {
        arel.Debug.log(this.objectName + ".onPaused()");
        /**** Begin of custom script ****/
        
        	showPlayButton(true);
           	showPauseButton(false);
        
        /***** End of custom script *****/
    };

    video1.onMovieEnded = function () {
        arel.Debug.log(this.objectName + ".onMovieEnded()");
        /**** Begin of custom script ****/
        
        	showPlayButton(true);
          	showPauseButton(false);
        
        /***** End of custom script *****/
    };

    video1.onVisible = function () {
        arel.Debug.log(this.objectName + ".onVisible()");
        /**** Begin of custom script ****/
        
        	this.pause();
          	showPlayButton(true);
           	showPauseButton(false);
        
        /***** End of custom script *****/
    };

    video1.onLoaded = function () {
        arel.Debug.log(this.objectName + ".onLoaded()");
        this.hide();
        if (this.displayOnLoaded) { 
            this.displayOnLoaded = false;
            this.display();
        }
        if (this.playOnLoaded) { 
            this.playOnLoaded = false;
            this.play();
        }
    };


    // Kick-off the AR experience by calling the scenario's onStartup() method as soon as AREL is ready
    scenario.onStartup();

    /**** Begin of custom global script ****/

// depending on flag(boolean), either set visible or invisible
function showPlayButton(flag)
{
   button1.setVisibility(flag, flag, flag);
}

function showPauseButton(flag)
{
   button2.setVisibility(flag, flag, flag);
}

    /***** End of custom global script *****/
});