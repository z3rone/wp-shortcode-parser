function getAllShortcodes(content) {
	let shortcodes = [];
	let sc_regex = /\[(\[)?(\/)?\s*([\w]+)\s*(((\s*[\w-]+\s*=\s*"[^"\[\]"]*"\s*)?(\s*[\w-]+\s*=\s*'[^'\[\]]*'\s*)?(\s*[\w-]+\s*=\s*[\w-]+\s*)?(\s*[\w-]+\s*)?)*)(\/)?(\])?\]/gm;
	let matches;
	let index = 0;
	// Get all shortcodes
	while((matches = sc_regex.exec(content)) !== null){
		let att_regex = /(\s*([\w-]+)\s*=\s*"([^"\[\]"]*)"\s*|\s*([\w-]+)\s*=\s*'([^'\[\]]*)'\s*|\s*([\w-]+)\s*=\s*([\w-]+)\s*|\s*([\w-]+)\s*)/g;
		let atts = [];
		let att_matches;
		// Get all attributes
		while((att_matches = att_regex.exec(matches[4])) !== null){
			atts.push({
				name: att_matches[2] || att_matches[4] || att_matches[6],
				value: att_matches[3] || att_matches[5] || att_matches[7] || att_matches[8]
			});
		}
		// Add shortcode to list
		shortcodes.push({
			index: index++,
			name: matches[3],
			attributes: atts,
			closing: matches[2] === '/',
			selfClosing: matches[10] === '/',
			escapeStart: matches[1] === '[',
			escapeEnd: matches[11] === ']',
			startIndex: matches.index,
			endIndex: matches.index + matches[0].length - 1,
			length: matches[0].length
		});
	}
	return shortcodes;
}

function getShortcodeStructure(content) {
	let shortcodes = getAllShortcodes(content);
	let scStack = [];
	// Iterate through shortcodes
	for(let sc of shortcodes){
		sc.container = false;
		if(sc.closing){
			let origin = scStack[sc.name].pop();
			
			/* TODO escaped SCs */
			
			// Join opening and closing tag
			sc.openedBy = origin;
			origin.closedBy = sc;
			origin.container = true;
			origin.children = [];
			// Add children
			for(let i=sc.index-1; i>sc.openedBy.index; i--){
				if(shortcodes[i].openedBy){
					// Skip grand children
					origin.children.unshift(shortcodes[i].openedBy);
					shortcodes[i].openedBy.parent = origin;
					i = shortcodes[i].openedBy.index; // Jump before opening tag
				} else {
					origin.children.unshift(shortcodes[i]);
					shortcodes[i].parent = origin;
				}
			}
		} else if(sc.selfClosing) continue;
		if(!scStack[sc.name]) scStack[sc.name] = [];
		scStack[sc.name].push(sc);
	}
	return shortcodes;
}

function getPostTree(content){
	let struct = getShortcodeStructure(content);
	return getNiveau(content, 0, content.length, 0, struct);
}

function getNiveau(content, start, end, index, struct){
	let root = [];
	
	let cIndex = index;
	let cursor = start;
	
	while(cursor < end){
		let sc  = struct[cIndex];
		let txt;
		// Get predecessing text
		if(!!sc){
			// Still shortcodes there
			txt = content.substring(cursor, sc.startIndex);
			// Only push non-empty strings
			if(txt!=="") root.push(txt);
			// Don't push out of bound tags
			if(sc.endIndex < end) root.push(sc);
			if(!!sc.closedBy){
				// Jump behind closing tag
				cursor = sc.closedBy.endIndex+1;
				cIndex = sc.closedBy.index+1;
			} else {
				// Continue behind tag
				cursor = sc.endIndex+1;
				cIndex = sc.index+1;
			}
		} else {
			// Only text left
			txt = content.substr(cursor);
			if(txt!=="") root.push(txt);
			cursor = content.length;
		}
	}
	
	for(let elem of root){
		if(typeof elem === "object" && !!elem.closedBy){
			// Generate children
			elem.cldn = getNiveau(content, elem.endIndex+1, elem.closedBy.startIndex, elem.index+1, struct);
			// Clean up
			delete elem.length;
			delete elem.closedBy;
			delete elem.startIndex;
			delete elem.endIndex;
			delete elem.index;
			elem.children = elem.cldn;
			delete elem.cldn;
			elem.escaped = elem.escapeStart;
			delete elem.escapeStart;
			delete elem.escapeEnd;
		}
	}
	return root;
}

function printTree(content){
	let tree = getPostTree(content);
	printTree_rec(tree, "")
}

function printTree_rec(tree, pre){
	for(let c of tree){
		if(typeof c === "object"){
			if(c.container){
				console.log(pre+'['+c.name+']');
				printTree_rec(c.children, pre+"\t");
				console.log(pre+'[/'+c.name+']');
			} else if(c.selfClosing){
				console.log(pre+'['+c.name+'/]');
			} else {
				console.log(pre+'['+c.name+']');
			}
		} else {
			console.log(pre+'"'+c+'"');
		}
	}
}