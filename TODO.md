### TODO list for the app

### ~~Stage 1~~ ✓ DONE:
"Complexity levels"
Remove the current levels/unlock mode and the "unlock button". Add 4 buttons on the header row that change the level of complexity. 
Beginner - simple chain with simple tool tips. Example: input - preamp - eq - comp - output. 
Intermediate - complex analogue mixer with aux busses, PFL bus, stereo and grouping, fx engine. 
Advanced - all possible future elements and functions of a professional digital mixer. Including ADC/DAC conversion points, usb interface, matrix busses, etc. 
Routing Madness - no rules, pure fun.


### ~~Stage 2~~ ✓ IMPLEMENTED (not fully tested):
"Cursor hover over mode"
Changes the function of the mouse cursor based on position on the page. 
1. On the plain field - Drag tool - hand cursor - navigate the signal chain (the current default function)
2. Along the signal chain line - Add tool - plus cursor - add a element to the chain. When the user clicks at any point along the signal chain a context menu opens with two main categories "Insert" and "Send". Both contain nested elements, based on position and complexity level. When Insert is selected, just add a element on the chain (eq,comp,dac). When "Send" is selected create a point in the chain and start drawing a line. When the user selects a second point on the map , that becomes a destination that other channels can connect to (fx engine, aux bus, pfl). Present a context menu with available elements (again based on starting position and level).
3. Over each element card - Modify tool - arrow cursor - based on the element change levels, show/hide tool tips, bypass and remove element. (Add on/off and "X" remove buttons at the top right of each element card.)

!!!Mouse scroll must always work as zoom tool! No change depending on hovering!!!

### Stage 3:
"Multi channel"
Add a "Add Source" button on the top left of the map that opens a few option for adding a channel to the signal chain. Line, Instrument, Mic. Add the new source below the previous and re-scale the whole map to make it understandable and not let things overlap, cross in weird ways. Give me some examples on what is possible here.

### Task 4:
"Signal across the chain"
Hide the current "Signal level across the chain" section by default to make more room for the signal chain and routing complexity. Add details button to each input and bus master. When the user clicks it, open the bottom drawer to see the state of the signal across the chain in more detail. Level, dynamic range, spectrum, etc. Again, give me some choices here and lets pick what is best.

### Task 5:
Settings button context menu
Put the languages in "Language" section and add the most common languages used in web apps. 
Add a light/dark theme button.
Save/load button. If possible, let the user export/import the current state of the chain.
Help button - starts a simple tutorial on how to use the app.

### Task 6:
"test test test"
Analyze and clean up the code base from junk and unused code that resulted from the development process. Check for files that are too large and need refactoring. Make sure the app is not bloated, over complicated and that it follows best practices. If needed, create some tests suite. I am not a developer, so if test scripts are not needed, skip them :)



