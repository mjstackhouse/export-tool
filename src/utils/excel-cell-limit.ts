import { IContentItem } from '@kontent-ai/delivery-sdk';

// Excel's maximum number of characters in a single cell (SheetJS refuses to write anything longer)
export const EXCEL_CELL_CHARACTER_LIMIT = 32767;

export type TooLongValue = {
  itemName: string,
  itemCodename: string,
  elementName: string,
  length: number
}

export class ExcelCellLimitError extends Error {
  // The message without its "Too long for Excel:" label, so the label can be styled separately on screen
  detail: string;

  constructor(languageName: string, tooLongValues: Array<TooLongValue>) {
    const [first] = tooLongValues;
    const remainingCount = tooLongValues.length - 1;
    const remainingNote = remainingCount > 0 ? `, and ${remainingCount} more ${remainingCount === 1 ? 'value is' : 'values are'} too long (see the browser console)` : '';
    const detail = `"${first.itemName}" (${languageName}), element "${first.elementName}" has ${first.length.toLocaleString()} characters${remainingNote}; Excel's limit is ${EXCEL_CELL_CHARACTER_LIMIT.toLocaleString()}. Export as CSV instead.`;

    super(`Too long for Excel: ${detail}`);

    this.name = 'ExcelCellLimitError';
    this.detail = detail;
  }
}

// itemsValues holds each item's element values in the same order as the item's elements, as they will be written to the cells
export function findValuesTooLongForExcel(items: Array<IContentItem>, itemsValues: Array<Array<unknown>>) {
  const tooLongValues: Array<TooLongValue> = [];

  items.forEach((item, itemIndex) => {
    Object.values(item.elements).forEach((element, elementIndex) => {
      const value = itemsValues[itemIndex][elementIndex];

      if (typeof value === 'string' && value.length > EXCEL_CELL_CHARACTER_LIMIT) {
        tooLongValues.push({
          itemName: item.system.name,
          itemCodename: item.system.codename,
          elementName: element.name,
          length: value.length
        });
      }
    });
  });

  return tooLongValues;
}
