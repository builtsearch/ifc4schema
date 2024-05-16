import fs from "fs";
import xml2js from "xml2js";
import chalk from "chalk";

const parser = new xml2js.Parser();
const file = fs.readFileSync("./schema/IFC4.xsd", "utf8");

const schema = await new Promise((resolve, reject) => {
	parser.parseString(file, (err, result) => {
		if (err) reject(err);
		resolve(result["xs:schema"]);
	});
});

// console.log(Object.keys(schema));

const ifcElements = schema["xs:complexType"]
	.map((x) => {
		const complexContent = x["xs:complexContent"];
		if (!complexContent) return;

		try {
			const allowed = ["ifc:IfcElement", "ifc:IfcSpatialStructureElement"];

			const extension = [...complexContent[0]["xs:extension"]][0];
			const base = extension["$"]["base"];
			if (!allowed.includes(base)) {
				return;
			}
			const name = x["$"]["name"];
			console.log(name);
			return name;
		} catch (e) {
			return;
		}
	})
	.filter((x) => x);

fs.writeFileSync("./schema/ifcElements.json", JSON.stringify(ifcElements, null, 2));
// fs.writeFileSync("./schema/schema.json", JSON.stringify(schema, null, 2));

let n = 0;
const ifc = [];
for (const element of ifcElements) {
	// if (n > 0) return;
	n++;
	const complexTypeRaw = schema["xs:complexType"].find((x) => {
		if (x["$"].name == element) {
			return x;
		}
	});

	const complexTypeData = Object.assign({}, complexTypeRaw["$"]);

	//if abstract get children
	if (complexTypeData.abstract) {
		// console.log(chalk.red("\n" + complexTypeData.name));
		schema["xs:complexType"]
			.filter((x) => {
				try {
					const complexContent = x["xs:complexContent"];

					const extension = complexContent.find((y) => y["xs:extension"])["xs:extension"][0];

					if (extension["$"].base !== `ifc:${complexTypeData.name}`) return;

					return x;
				} catch (e) {
					return;
				}
			})
			.forEach((x) => {
				const name = x["$"].name;

				if (!x["$"].abstract) {
					return ifc.push({ entity: name });
				}

				const types = getNameFromBase(name);
				types.forEach((name) => {
					ifc.push({ entity: name });
				});
			});
		continue;
	}

	//if not abstract, push entity and its children

	const names = getChildrenRecursion(complexTypeData.name);
	names.forEach((name) => ifc.push({ entity: name }));
}

for (const item of ifc) {
	// console.log(chalk.red(item.entity));
	const complexType = schema["xs:complexType"].find((x) => x["$"].name == item.entity);
	const extension = complexType["xs:complexContent"][0]["xs:extension"][0];

	const attribute = extension["xs:attribute"];
	if (!attribute) continue;

	const type = attribute.find((x) => x["$"].name == "PredefinedType");
	if (!type) continue;
	const typeEnum = type["$"].type.replace("ifc:", "");

	// console.log(">", typeEnum);
	//get preDefinedType
	const simpleType = schema["xs:simpleType"].find((x) => x["$"].name == typeEnum);
	const enums = simpleType["xs:restriction"][0]["xs:enumeration"].map((x) => x["$"].value.toUpperCase());

	// console.log(enums);

	item.predefinedType = enums;
}

fs.writeFileSync("./schema/schema.json", JSON.stringify(ifc, null, 2));

function getChildrenRecursion(name) {
	let childNames = [name];
	getNameFromBase(name).forEach((childName) => {
		childNames.push(...getChildrenRecursion(childName));
	});
	return childNames;
}

function getNameFromBase(base) {
	const names = schema["xs:complexType"]
		.filter((x) => {
			try {
				const complexContent = x["xs:complexContent"];
				if (complexContent[0]["xs:extension"][0]["$"].base == `ifc:${base}`) {
					return x;
				}
			} catch (e) {
				return;
			}
		})
		.map((x) => x["$"].name);

	return names;
}
