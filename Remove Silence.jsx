var currentItem = app.project.activeItem;
if (currentItem == null || !(currentItem instanceof CompItem)) {
    alert(
        "Cannot run script on this item. Please highlight a 'Composition' and run the script again"
    );
}

app.beginSuppressDialogs();

var project = app.project;
var comp = project.activeItem;
var layer = comp.layer(1);  // Original layer

var mainWindow = new Window("palette", "Remove Silence", undefined);
mainWindow.orientation = "column";

var groupOne = mainWindow.add("group", undefined, "groupOne");
groupOne.add(
    "statictext",
    undefined,
    "Select a comp and layer, set padding, and run to auto-edit"
);

var groupTwo = mainWindow.add("group", undefined, "groupTwo");
groupTwo.orientation = "row";
groupTwo.add("statictext", [0, 0, 100, 25], "Padding (frames)");
var pad = groupTwo.add("slider", undefined, 5, 0, 60);
groupTwo.size = [300, 30];
var paddingValue = groupTwo.add("statictext", undefined, parseInt(pad.value));
paddingValue.size = [40, 30];
pad.onChanging = function () {
    paddingValue.text = parseInt(pad.value);
};


var groupThreshold = mainWindow.add("group", undefined, "groupThreshold");
groupThreshold.orientation = "row";
groupThreshold.add("statictext", [0, 0, 100, 25], "Threshold");
var thres = groupThreshold.add("slider", undefined, 1, 0, 10);
groupThreshold.size = [300, 30];
var thresholdValue = groupThreshold.add("statictext", undefined, thres.value);
thresholdValue.size = [40, 30];
thres.onChanging = function () {
    thresholdValue.text = thres.value.toFixed(1);
};


var groupThree = mainWindow.add("group", undefined, "groupThree");
groupThree.orientation = "column";
var keepOriginalCheckbox = groupThree.add("checkbox", undefined, "Keep Original");
var rippleDeleteCheckbox = groupThree.add("checkbox", undefined, "Ripple Delete");
var onlySilenceCheckbox = groupThree.add("checkbox", undefined, "Only Silence (Invert)");


var groupFour = mainWindow.add("group", undefined, "groupFour");
var button = groupThree.add("button", undefined, 'Go!');

mainWindow.center();
mainWindow.show();



button.onClick = function () {
    app.beginUndoGroup("Auto Editing");
    convertAudio();

    var keyInfo = calculateKeys();

    editVideo(keyInfo[0], keyInfo[1]);
    alert("Completed!", "Success");
    app.endUndoGroup();
};

function convertAudio() {
    app.executeCommand(app.findMenuCommandId("Convert Audio to Keyframes"));
}

function calculateKeys() {
    var keyTimes = new Array();
    var keyValues = new Array();
    var audioLayer = comp.layer(1);
    var slider = audioLayer("Effects")("Both Channels")("Slider");
    for (var i = 1; i <= slider.numKeys; i++) {
        keyTimes.push(slider.keyTime(i));
        keyValues.push(slider.keyValue(i));
    }
    audioLayer.remove();
    return [keyTimes, keyValues];
}

function editVideo(keyTimes, keyValues) {
    var inAndOutTimes = new Array();
    var isRun = false;
    var counter = 0;
    var padding = parseInt(paddingValue.text);
    var threshold = parseFloat(thresholdValue.text);

    for (var i = 0; i < keyTimes.length; i++) {
        if (!isRun) {
            if (keyValues[i] >= threshold) {  // if audio starts
                isRun = true;
                if (keyValues[i - padding] >= 0) {
                    inAndOutTimes[inAndOutTimes.length] = keyTimes[i - padding];
                }
                else {
                    inAndOutTimes[inAndOutTimes.length] = keyTimes[0];
                }
            }
        }
        else {
            if (keyValues[i] < threshold) {  // if silence starts
                counter++
                if (counter >= padding) {
                    isRun = false;
                    counter = 0;
                    inAndOutTimes[inAndOutTimes.length] = keyTimes[i - 1];
                }
            }
            else if (keyValues[i] >= threshold) {
                counter = 0;
            }
        }
    }


    if (inAndOutTimes.length % 2 != 0) {
        inAndOutTimes[inAndOutTimes.length] = keyTimes[keyTimes.length - 1];
    }
    // End of getting In and Out Times section

    // Cutting section
    if (onlySilenceCheckbox.value){
        inAndOutTimes.unshift(0);
        if(inAndOutTimes[inAndOutTimes.length - 1] != keyTimes[keyTimes.length - 1]){
            inAndOutTimes[inAndOutTimes.length] = keyTimes[keyTimes.length - 1];
        }
        else{
            inAndOutTimes.pop();
        }
    }

    for (var e = 0; e < inAndOutTimes.length; e += 2) {
        var currentLayer = layer.duplicate();
        currentLayer.inPoint = inAndOutTimes[e];
        currentLayer.outPoint = inAndOutTimes[e + 1];
    }

    if (!keepOriginalCheckbox.value) {
        layer.remove();
    }

    if (rippleDeleteCheckbox.value) {
        var startTime = 0;
        var length = keepOriginalCheckbox.value ? --comp.numLayers : comp.numLayers;
        for (var z = 1; z <= length; z++) {
            var thisLayer = comp.layer(z);
            thisLayer.name = z;
            thisLayer.inPoint = startTime;
            startTime = thisLayer.outPoint;
        }
        var lastLayerIndex = keepOriginalCheckbox.value ? --comp.numLayers : comp.numLayers;
        comp.workAreaDuration = comp.layer(comp.numLayers).outPoint; // set comp duration to final layer's ending point
        app.executeCommand(app.findMenuCommandId("Trim Comp to Work Area"));
    }

    layer.inPoint = keyTimes[0];
    layer.outPoint = comp.workAreaDuration;
}