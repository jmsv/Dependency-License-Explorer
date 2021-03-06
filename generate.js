var dependencies = [], whitelisted = [], tree = {};
function createDependency(dependency, mode){
	var generated = '<label class="dependency">\n';
	if(dependency.children.length > 0) generated += '\t<input type="radio" name="tier'+dependency.index.length+'"/>\n';
	generated += '\t<div class="item">\n\t\t<div class="icons">\n';
	if(dependency.warnings > 0) generated += '\t\t\t<div class="warnings">'+dependency.warnings+'</div>\n';
	if(dependency.conflicts > 0) generated += '\t\t\t<div class="conflicts">'+dependency.conflicts+'</div>\n';
	generated += '\t</div>\n\t\t<div class="content '+dependency.flag+'">\n';
	generated += '\t\t\t<p>'+dependency.name+'</p>\n';
	if(mode != 2) generated += '\t\t\t<a href="#" onclick="show(['+dependency.index+'])">More info...</a>\n';
	generated += '\t\t</div>\n\t</div>\n';
	if(dependency.children.length > 0){
		generated += '\t<div class="dependencies">\n';
		for(var index = 0; index < dependency.children.length; index++)
			generated+=createDependency(dependency.children[index], mode);
		generated+='\t</div>\n';
	}
	generated+='</label>\n';
	return generated;
}
function generate(mode, name){
	var generated = createDependency(tree.children[0], mode);
	switch(mode){
		case "0": 
			generated = allinone(generated);
			break;
		case "1": 
			generated = separate(generated);
			break;
		case "2": 
			generated = htmlcss(generated);
			break;
	}
	download(generated, name+'.html','html');
}
function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"), 
			url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}
function safeLicense(license){
	if(whitelisted.length == 0)
		return true;
	for(var index = 0; index < whitelisted.length; index++)
		if(whitelisted[index] == license)
			return true;
	return false;
}
function processTree(file){
	var lines = file.content.split('\n'),
		lines = lines.filter((line)=>line.length>0);
	var indexes = [], prevDepth = 0;
	for(var lineIndex = 0; lineIndex < lines.length; lineIndex++){
		var depth = (/[^\w]*/.exec(lines[lineIndex])[0].length)/3,
			GAV = /[^:]*:[^:]*/.exec(lines[lineIndex].replace(/[^\w]*/.exec(lines[lineIndex])[0],''))[0],
			info = -1,
			flag = "";
		
		for(var index = 0; index < dependencies.length; index++)
			if(dependencies[index].GAV == GAV)
				info = dependencies[index];
		
		if(info == -1) flag = "missing";
		else if(!safeLicense(info.license)) flag = "conflict";
				
		var currentItem = tree;
		for(var index = 0; index < indexes.length - 1; index++){
			if (flag == "missing") currentItem["warnings"]++; 
			if (flag == "conflict") currentItem["conflicts"]++; 
			currentItem = currentItem.children[indexes[index]];
		}
		if (flag == "missing") currentItem["warnings"]++; 
		if (flag == "conflict") currentItem["conflicts"]++; 		
		if (currentItem.children) currentItem.children.push({warnings: 0, conflicts:0, flag:flag, license:info.license, name:info.name||GAV, GAV:info.GAV, index:indexes.slice(), children:[]});
		else tree =  {warnings: 0, conflicts:0, flag:flag, license:info.license, name:info.name, GAV:info.GAV, depth: depth, children:[]};
		
		for(var popNamount = 0; popNamount < prevDepth-depth; popNamount++)
			indexes.pop();
		indexes[depth]++;
		if(!indexes[depth]) indexes[depth] = 0;
		
		prevDepth = depth;
	}
	console.log("INFO: JSON data");
	console.log(tree);
}
function process3rdParty(file){
	var lines = file.content.split('\n');
	for(var index = 0; index < lines.length; index++){
		var components = lines[index].split(/[()]/),
			GAV = components[components.length-2];
		if(GAV)
			GAV = /[^:]*:[^:]*/.exec(GAV.replace(/[^\w]*/.exec(GAV)[0],''))[0];
		if(components.length == 5)
			dependencies.push({license: components[1], name:components[2].trim(), GAV:GAV});
		if(components.length < 5)
			console.log("WARN: Line", index, "has fewer than 3 components:", lines[index])
		if(components.length > 5){
			var calculatedName = components[2];
			for(var componentIndex = 3; componentIndex < components.length - 3; componentIndex++)
				calculatedName += "("+components[componentIndex]+")";
			console.log("WARN: Line", index, "has more than 3 components but was added with the assumed name of:", calculatedName.trim());
			dependencies.push({license: components[1], name:calculatedName.trim(), GAV:GAV });
		}
	}
	console.log("INFO: Module dependency information");
	console.log(dependencies);	
}
function process(files,mode, name){
	var count=0, required=2;
	for(var index = 0; index < files.length; index++)
		if(files[index].name == "THIRD-PARTY.txt"){
			process3rdParty(files[index]);
			count++;
			required--;
		}else if(files[index].name == "tree.txt"){
			processTree(files[index]);
			count++;
			required--;
		}else {
			
		}
	if (count < files.length)
		console.log("WARN: Not all files were processed, ensure they have exactly the correct file names");
	if(required==0) generate(mode, name);
	else console.log("CRIT: Missing required file");
}
function read(e){
	e.preventDefault();
	if(document.getElementById('files').files.length > 2)
		return;
	var files = [],
		group =  document.getElementById('files').files,
		name =  document.getElementById('name').value || "generated",
		combine = document.getElementsByName('generation'),
		mode = 0;
	for(var i = 0; i < combine.length; i++)
		if(combine[i].checked){
			mode = combine[i].value;
			break;
		}
		
	document.getElementsByTagName('body')[0].innerHTML = "";
	for(var index = 0; index < group.length; index++){
		var reader = new FileReader();
		reader.name = group[index].name; /*Hackish but works*/
		reader.onload = function(e2) {
			files.push({name:this.name,content:e2.currentTarget.result});
			if(files.length >= 2 && index==group.length){
				process(files,mode,name);
			}
		};
		reader.readAsText(group[index]);
	}
}
document.getElementsByTagName('form')[0].addEventListener('submit',read,false);