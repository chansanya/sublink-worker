import { DeepCopy } from "./utils.js";
import { ProxyParser } from "./ProxyParsers.js";

const safeParse = async (url) => {
  try {
    return await ProxyParser.parse(url);
  } catch (error) {
    console.warn("Skipped invalid proxy:", error.message);
    return null;
  }
};

export class BaseConfigBuilder {
  constructor(inputString, baseConfig) {
    this.inputString = inputString;
    this.config = DeepCopy(baseConfig);
    this.customRules = [];
  }
  async build() {
    const customItems = await this.parseCustomItems();
    this.addCustomItems(customItems);
    this.addSelectors();
    return this.formatConfig();
  }
  async parseCustomItems() {
    const urls = this.inputString.split("\n").filter((url) => url.trim() !== "");
    const parsedItems = [];
    for (const url of urls) {
      const result = await safeParse(url);
      if (Array.isArray(result)) {
        for (const subUrl of result) {
          const subResult = await safeParse(subUrl);
          if (subResult) {
            parsedItems.push(subResult);
          }
        }
      } else if (result) {
        parsedItems.push(result);
      }
    }
    return parsedItems;
  }
  addCustomItems(customItems) {
    throw new Error("addCustomItems must be implemented in child class");
  }
  addSelectors() {
    throw new Error("addSelectors must be implemented in child class");
  }
  formatConfig() {
    throw new Error("formatConfig must be implemented in child class");
  }
}

