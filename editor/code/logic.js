
var mods = window.opener ?
		window.opener.mods || new Emitter([]) :
		new Emitter([]);

var logic = {
	
	//Saving/loading objects
	localFileInput: document.createElement('input'),
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
		
		this.localFileInput.setAttribute('type', 'file');
		this.localFileInput.addEventListener('change',
				this.handleLocalInput.bind(this), false);
		
		this.fileReader.onload = this.loadLocalFile.bind(this);
		
		/**************************************************************************
		 **	Events
		 **************************************************************************/
		
		//Mods (other windows)
		mods.on("push", this.newMod.bind(this));
		
    /**************************************************************************
		 **	Load our mods
		 **************************************************************************/
    
    for (var i = 0, mod; mod = mods[i]; i++)
			this.newMod({detail: {mod: mod}});
		
	}
};

/******************************************************************************
 ******************************************************************************
 **	UI
 ******************************************************************************
 ******************************************************************************/

logic.idToCode = function(id) {
  
  var path = id.split('_');
	
  var section = mods[path.shift().substring(1)].code;
	
  while (path.length)
    section = section[path.shift()];
  
  return section;
};

/******************************************************************************
 **	Builder
 ******************************************************************************/

logic.newMod = function(e, skipLoad) {
	
	var mod = e.detail.mod;
	
	//First mod, so add the caret
	this.modCaret.style.display = 'inline-block'
	
	//Now let's create our new menu item & append it
	
	var listItem = document.createElement('li');
	
	var link = document.createElement('a');
	link.innerText = mod.meta.title;
	
	listItem.appendChild(link);
	this.modList.appendChild(listItem);
	
	//Okay, let's load the code
	this.loadSection('m' + (mods.length-1), mod.path(), mod.code);
	
};

/**
 * Adds a section to the tree
 * @param {string|number} id The id of the section
 * @param {string} value The display text
 * @param {object} code An object containing at least _value, possibly children
 * @param {string|number|null} parent The id of the parent (see param1)
 */
logic.loadSection = function(id, value, code, parent) {
  
  //If the parent exists, define it in the add, otherwise don't
	
	var li = document.createElement('li');
	
	var input = document.createElement('input');
	input.setAttribute('type', 'checkbox');
	//input.setAttribute('name', parent || 'mods');
	input.setAttribute('id', id);
	
	var label = document.createElement('label');
	label.setAttribute('for', id);
	label.className = 'caret';
	
	var text = document.createElement('span');
	text.innerText = value;
	
	li.appendChild(input);
	li.appendChild(label);
	li.appendChild(text);
	
	//Not a mod-level section, so we're adding to a list
  if (parent) {
		
		//Grab the parent and the list
		parentEle = document.getElementById(parent).parentNode;
		var childList = parentEle.children[3];
		
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
	
  //Make sure we're working with an object
	if (typeof code == 'object')
    
    //Grab the children (not value)
		for (var sub in code)
      if (code.hasOwnProperty(sub) && sub != '_value' && sub != '_session')
        
        //Recursively add children
				this.loadSection(parent + '_' + sub, sub, code[sub], parent);
};

/******************************************************************************
 **	Save/load
 ******************************************************************************/

logic.loadLocalFile = function(e, blah, blah2) {
	var file = this.fileReader.result;
	
	var mod = Mod.load(file);
	var id = mods.push(mod) - 1;
	
	mods.emit('push', new CustomEvent('push', {
		detail: {mod: mod, id: id}
	}));
};

logic.handleLocalInput = function(e) {
	var file = e.target.files[0];
	this.fileReader.readAsText(file);
};

logic.openLocal = function() {
	this.localFileInput.click();
};

logic.saveLocal = function() {
	
	if (!this.currentMod) {
		message({
			error: true,
			text: 'You must select a mod to add a selection to.'
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
	var next = li.children[3];
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
  
	if (e.target.tagName == 'SPAN' && e.target.className != 'caret' &&
			e.target.parentNode.children[0].id.indexOf('_') > 0) {
		
		e.target.oldText = e.target.innerText;
		e.target.setAttribute('contentEditable', true);
		e.target.focus();
		selectText(e.target);
	}
	
};
 
logic.newSection = function() {
	var parentId = this.tree.getSelectedId();
	var parent = this.tree.getSelectedItem();
	
	if (!parent) {
		message({
			error: 'true',
			text: 'You must select a mod to add a selection to.'
		});
		
		return;
	}
	
  var section = this.idToCode(parentId);
  var value = 'Untitled';
  
  if (typeof section[value] != 'undefined') {
    var num = 2;
    
    while (typeof section[value + ' ' + num] != 'undefined')
      num++;
    
    value = value + ' ' + num;
  }
  
	section[value] = {_value: ''};
  
	this.tree.add({
		id: parentId + "_" + value,
		value: value
	}, null, parentId);
};

logic.onChange = function(e, section) {
  section._value = this.coder.getValue();
};

logic.selectSection = function(e) {
	
	//Ignore the span event
	if (e.target.tagName != 'SPAN') return;
	
	//Get the id and update currentMod
	var id = e.target.parentNode.children[0].id;
	this.currentMod = id.split('_')[0].substr(1);
	
	//Grab the section
  var section = this.idToCode(id);
	
	//Create a session if it does not exist
  if (typeof section._session == "undefined") {
    section._session = ace.createEditSession(
      section._value, 'ace/mode/javascript'
    );
    
    section._session.on('change', function(e) {
      this.onChange(e, section);
    }.bind(this));
  }
  
  //Set the session
  this.coder.setSession(section._session);
	
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
		case 'Open local':
			this.openMethod.nodeValue = 'Open local ';
			this.openLocal();
			break;
		case 'Save local':
			this.saveMethod.nodeValue = 'Save local ';
			this.saveLocal();
			break;
		
		//Edit
		case 'Rename section': this.renameSection(); break;
		case 'New section': this.newSection(); break;
		
		//window
		case 'Terrain Editor': window.open('..'); break;
		case 'Code Editor': window.open('../code'); break;
		
		default: console.log('woot');
	}
	
	if (ele.parentNode.tagName != 'NAV')
		setTimeout(function() {
			ele.style.display = null;
		}, 50);
};
