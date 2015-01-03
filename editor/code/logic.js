
var mods = window.opener ?
		window.opener.mods || new Emitter([]) :
		new Emitter([]);

var logic = {
	
	//Saving/loading objects
	fileInput: document.createElement('input'),
	fileReader: new FileReader(),
	
	currentMod: null,
	
	//UI objects
  modCaret: null,
	modList: null,
	openMethod: null,
	saveMethod: null,
	
	tree: null,
	coder: null,
  
  init: function() {
		
    /**************************************************************************
		 **	Build our UI context
		 **************************************************************************/
    
		//Bind elements
		
		this.modCaret = document.getElementById('mod').children[0].children[0];
		this.modList = document.getElementById('mod').children[1];
		
		this.openMethod = document.getElementById('open').firstChild;
		this.saveMethod = document.getElementById('save').firstChild;
		
		this.tree = document.getElementById('tree').children[0];
    
    //Events
		
    $('#menu').click(this.menuSwitch.bind(this));
		
		$('#tree').click(this.selectSection.bind(this));
		$('#tree').dblclick(this.renameSection.bind(this));
		
		$('#tree').focusout(this.finishRename.bind(this));
		
    /**************************************************************************
		 **	Coder
		 **************************************************************************/
    
		//$$('code').$view.id = 'code';
		
		this.coder = ace.edit('code');
		this.coder.$blockScrolling = Infinity;
    
		/**************************************************************************
		 **	Flesh out our file readers
		 **************************************************************************/
		
		this.fileInput.setAttribute('type', 'file');
		this.fileInput.addEventListener('change',
				this.handleFileInput.bind(this), false);
		
		this.fileReader.onload = this.loadfile.bind(this);
		
		/**************************************************************************
		 **	Events
		 **************************************************************************/
		
		//Mods (other windows)
		mods.on("push", this.newMod.bind(this));
		
    /**************************************************************************
		 **	Load our mods
		 **************************************************************************/
    
    for (var i = 0, mod; mod = mods[i]; i++)
			this.newMod({detail: {mod: mod}}, i);
		
	}
};

/******************************************************************************
 ******************************************************************************
 **	UI
 ******************************************************************************
 ******************************************************************************/

logic.idToCode = function(id) {
  
	//Split path into parts
  var path = id.split('_');
	
	//Grab the mod we need
  var section = mods[path.shift().substring(1)].code;
	
	//Loop until we've exhausted the path
	var next;
  while (path.length) {
		next = path.shift();
		
		//Loop until we've found the corret child
		for (var i = 0; section.children[i].name != next; i++) {}
		
		//Found it, set and repeat (or exit if finished)
    section = section.children[i];
		
	}
  
	//Found it!
  return section;
};

/******************************************************************************
 **	Builder
 ******************************************************************************/

logic.newMod = function(e, version) {
	
	var mod = e.detail.mod;
	
	//First mod, so add the caret
	this.modCaret.style.display = 'inline-block'
	
	//Now let's create our new menu item & append it
	
	var listItem = document.createElement('li');
	
	var link = document.createElement('a');
	link.innerText = mod.meta.title;
	
	listItem.appendChild(link);
	this.modList.appendChild(listItem);
	
	//If version is unset, just use length (it's probably from an event)
	if (typeof version == 'undefined')
		 version = mods.length - 1;
	
	//Okay, let's load the code
	this.loadSection('m' + version, mod.meta.title, mod.code.children);
	
};

/**
 * Adds a section to the tree
 * @param {string|number} id The id of the section
 * @param {string} value The display text
 * @param {object} code An object containing at least _value, possibly children
 * @param {string|number|null} parent The id of the parent (see param1)
 */
logic.loadSection = function(id, value, children, parent) {
  
  //If the parent exists, define it in the add, otherwise don't
	
	//Container for the entire section
	var li = document.createElement('li');
	
	//Used to control whether children are hidden/shown
	var input = document.createElement('input');
	input.setAttribute('type', 'checkbox');
	input.setAttribute('id', id);
	
	//Used to toggle hide/show of children (and display state)
	var label = document.createElement('label');
	label.setAttribute('for', id);
	label.className = 'caret';
	
	//The actual text of the section
	var text = document.createElement('span');
	text.className = 'sectionName';
	text.innerText = value;
	
	//A container for controls (+/-)
	var controls = document.createElement('span');
	controls.className = 'controls';
	
	//Used to add a child
	var add = document.createElement('span');
	add.className = 'add';
	add.innerText = '+';
	
	//Used to remove current section
	var remove = document.createElement('span');
	remove.className = 'remove';
	remove.innerText = '–';
	
	//Build our controls
	controls.appendChild(add);
	if (id.indexOf('_') >= 0) controls.appendChild(remove);
	
	//And now build our item
	li.appendChild(input);
	li.appendChild(label);
	li.appendChild(text);
	li.appendChild(controls);
	
	//Not a mod-level section, so we're adding to a list
  if (parent) {
		
		//Grab the parent and the list
		parentEle = document.getElementById(parent).parentNode;
		var childList = parentEle.children[4];
		
		//List doesn't exist yet so create it
		if (!childList) {
			childList = document.createElement('ul');
			parentEle.appendChild(childList);
		}
		
		//Append to list
		childList.appendChild(li);
		
		//Make sure parent caret is visible
		parentEle.children[1].style.opacity = 1;
	
	//Mod-level section
	} else this.tree.appendChild(li);
	
  //Set our parent, only used for possible children
	parent = id;
	
  //Make sure we're working with an object (Array)
	if (typeof children == 'object' && children != null)
    
    //Grab the children (not value)
		for (var i = 0, sub; sub = children[i]; i++)
      
			//Recursively add children
			this.loadSection(parent + '_' + sub.name, sub.name, sub.children, parent);
};

/******************************************************************************
 **	Save/load
 ******************************************************************************/

logic.loadfile = function(e, blah, blah2) {
	var file = this.fileReader.result,
			mod = Mod.load(file),
			id = mods.push(mod) - 1;
	
	mods.emit('push', new CustomEvent('push', {
		detail: {mod: mod, id: id}
	}));
};

logic.handleFileInput = function(e) {
	var file = e.target.files[0];
	this.fileReader.readAsText(file);
};

logic.openFile = function() {
	this.fileInput.click();
};

logic.saveFile = function() {
	
	if (!this.currentMod) {
		message({
			error: true,
			text: 'You must select a mod to save.'
		});
		
		return;
	}
	
	mods[this.currentMod].window = window;
	mods[this.currentMod].save();
};

/******************************************************************************
 **	Interactivity
 ******************************************************************************/

logic.rFinishRename = function(li, oldName, newName) {
	
	//Update the input and label
	li.children[0].id = li.children[0].id.replace(oldName, newName);
	li.children[1].setAttribute('for',
			li.children[1].getAttribute('for').replace(oldName, newName));
	
	//And update any sublists
	var next = li.children[4];
	if (next)
		for (var i = 0, child; child = next.children[i]; i++)
			this.rFinishRename(child, oldName, newName);
	
};

logic.finishRename = function(e) {
	
	//Fix anything wonky (should probably make it id-valid)
	e.target.innerHTML = e.target.innerText
			.replace(/ /g, '&nbsp;')
			.replace(/_/g, '&nbsp;');
	
	//No more edits
	e.target.removeAttribute('contentEditable');
	
	//Grab info about the current item
	var curId = e.target.parentNode.children[0].id;
	var curItem = e.target.parentNode;
	
	//Get the id of parent and the suffix of current
	var parentId = curId.substr(0, curId.lastIndexOf('_'));
	var oldName = e.target.oldText;
	
	//Now grab the section of code
	var parentSection = this.idToCode(parentId);
	
	//We got everything, just grab the new name
	var newName = e.target.innerText;
	
	//Swap in code
	parentSection[newName] = parentSection[oldName];
	delete parentSection[oldName];
	
	//Swap in HTML
	this.rFinishRename(curItem, parentId + '_' + oldName,
			parentId + '_' + newName);
	
};

/**
 * Renames a section using an ugly prompt
 * 
 */
logic.renameSection = function(e) {
  
	if (e.target.className == 'sectionName' &&
			e.target.parentNode.children[0].id.indexOf('_') > 0) {
		
		e.target.oldText = e.target.innerText;
		e.target.setAttribute('contentEditable', true);
		e.target.focus();
		selectText(e.target);
	}
	
};

logic.onChange = function(e, section) {
	section.code = this.coder.getValue();
};

logic.selectSection = function(e) {
	
	//Section name selected, change code sessions
	if (e.target.className == 'sectionName') {
		
		//Get the id and update currentMod
		var id = e.target.parentNode.children[0].id;
		this.currentMod = id.split('_')[0].substr(1);
		
		//Grab the section
		var section = this.idToCode(id);
		
		//Create a session if it does not exist
		if (typeof section._session == "undefined") {
			section._session = ace.createEditSession(
				section.code, 'ace/mode/javascript'
			);
			
			section._session.on('change', function(e) {
				this.onChange(e, section);
			}.bind(this));
		}
		
		//Set the session
		this.coder.setSession(section._session);
	
	//New section clicked
	} else if (e.target.className == 'add') {
		
		//Grab the id
		var currentId = e.target.parentNode.parentNode.children[0].id;
		
		//Grab the section and define our first-pass section name
		var section = this.idToCode(currentId);
		var name = 'Untitled',
				num = '';
		
		//Children not defined, so just define it and we know it's not taken
		if (typeof section.children == 'undefined' || section.children == null)
			section.children = [];
		
		//Children is defined, so we must make sure we're unique
		else {
			
			//General flag for searching
			var flag = true;
			
			//Loop while flag is true
			while (flag) {
				
				//Set flag to false, meaning currently unfound
				flag = false;
				
				//Loop through all children
				for (var i = 0, child; child = section.children[i]; i++)
					
					//Name already taken, try again with num++
					if (child.name == name + num) {
						num = (parseInt(num) || 1) + 1;
						flag = true;
						break;
					}
			}
		}
		
		//Set name to include num (num may be blank)
		name += num;
		
		//Define the new section in code
		section.children.push({name: name, code: ''});
		
		//Add the new section to the tree
		this.loadSection(currentId + '_' + name, name, null, currentId);
		
		//Show the section if it's not
		e.target.parentNode.parentNode.children[0].checked = true
	
	//Remove section clicked
	} else if (e.target.className == 'remove') {
		
		//Grab info about the current item
		var curId = e.target.parentNode.parentNode.children[0].id;
		var curItem = e.target.parentNode.parentNode;
		var listNode = curItem.parentNode;
		
		//Verify they want to delete
		if (prompt('Are you sure you want to delete ' +
				curItem.children[2].innerText + ' (type "yes")?') != 'yes')
			return;
		
		//Get the id of parent
		var parentId = curId.substr(0, curId.lastIndexOf('_'));
		var curName = curId.substr(curId.lastIndexOf('_') + 1);
		
		//Now grab the section of code
		var parentSection = this.idToCode(parentId);
		
		//Remove in code
		for (var i = 0, child; child = parentSection.children[i]; i++)
			if (child.name == curName) {
				parentSection.children.splice(i, 1);
				break;
			}
		
		//Remove in HTML
		curItem.remove();
		
		//Hide the caret if now empty
		if (listNode.children.length == 0)
			listNode.parentNode.children[1].style.opacity = 0;
		
	}
	
};

logic.menuSwitch = function(e) {
	var which = e.target;
	if (which.tagName == 'LI')
		which = which.children[0];
	
	which = which.innerText.trim();
	
	var ele = e.target;
	while (ele.tagName != 'UL')
		ele = ele.parentNode
	
	if (ele.parentNode.tagName != 'NAV')
		ele.style.display = 'none';
	
	switch (which) {
		
		//File
		case 'New': window.open('../new', 'New Mod',
				'width=250,height=500,scrollbars=no,location=no'); break;
		case 'Open file':
			this.openMethod.nodeValue = 'Open file ';
			this.openFile();
			break;
		case 'Save file':
			this.saveMethod.nodeValue = 'Save file ';
			this.saveFile();
			break;
		
		//window
		case 'Terrain Editor': window.open('..'); break;
		case 'Code Editor': window.open('../code'); break;
		
		default: console.log('woot', which);
	}
	
	if (ele.parentNode.tagName != 'NAV')
		setTimeout(function() {
			ele.style.display = null;
		}, 50);
};
