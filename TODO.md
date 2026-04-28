### TODO list for the app
Complete refactor based on SmartDraw ShapeConnector from the Electric Circuit Diagram tool.

https://app.smartdraw.com/editor.aspx?templateId=c3279871-f5c1-4e3d-b886-e7bb1d5ea50a&flags=128

### Task 1:
Complete cleanup and removal of the current signal chain line, signal level calculation method and connection insertion points!
Don't touch the canvas, drag method for movement and zoom, main menus, styles and node functions for now

### Task 2:
Create a menu on the left that will keep all the possible elements (like most drawing apps) and place the existing elements there.
Splitter is no longer needed because we will just connect to the existing line. Remove it from the codebase!

### Task 3:
Create a new element called "line tool". Copy the exact way SmartDraw handles the line drawing between elements. Each element has a single input and output connection. Every connection can except multiple lines connected to it! The line will be a passive element with no complexity once drawn it will only determine direction of signal flow and nothing else!
 Simplicity and general purpose is the name of the game!!

### Task 4:

Redesign the starting point.
The app starts as a blank canvas - just like SmartDraw or any other drawing app. The user can pick freely from any element in the left menu and place it wherever he wants. Then connect the elements with the line tool. The app must honor the direction of connections. First click of the line tool is output to another element and the second click is the input to the connected element. The arrow must follow that.

Levels determine what is visible in the elements menu and how the elements look (the current behavior)

### Task 5:

"test test test"
Analyze and clean up the code base from junk and unused code that resulted from the development process. Check for files that are too large and need refactoring. Make sure the app is not bloated, over complicated and that it follows best practices. If needed, create some tests suite. I am not a developer, so if test scripts are not needed, skip them :)



