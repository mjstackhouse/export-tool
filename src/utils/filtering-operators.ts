export const filteringOperators = {
  modular_content: {
    'contains the following item': 'containsFilter',
    'contains at least one of the following items': 'anyFilter',
    'contains all of the following items': 'allFilter'
  },
  number: {
    'equals': 'equalsFilter',
    'does not equal': 'notEqualsFilter',
    'is less than': 'lessThanFilter',
    'is less than or equal to': 'lessThanOrEqualToFilter',
    'is greater than': 'greaterThanFilter',
    'is greater than or equal to': 'greaterThanOrEqualFilter',
    'is in the range of': 'rangeFilter'
  },
  multiple_choice: {
    'contains the following option': 'containsFilter',
    'contains at least one of the following options': 'anyFilter',
    'contains all of the following options': 'allFilter'
  },
  rich_text: {
    'equals': 'equalsFilter',
    'does not equal': 'notEqualsFilter'
  },
  subpages: {
    'contains the following page': 'containsFilter',
    'contains at least one of the following pages': 'anyFilter',
    'contains all of the following pages': 'allFilter'
  },
  taxonomy: {
    'contains the following term': 'containsFilter',
    'contains at least one of the following terms': 'anyFilter',
    'contains all of the following terms': 'allFilter'
  },
  text: {
    'equals': 'equalsFilter',
    'does not equal': 'notEqualsFilter'
  },
  url_slug: {
    'equals': 'equalsFilter',
    'does not equal': 'notEqualsFilter'
  },
  date_time: {
    'equals': 'equalsFilter',
    'does not equal': 'notEqualsFilter',
    'is before': 'lessThanFilter',
    'is before or the same as': 'lessThanOrEqualToFilter',
    'is after': 'greaterThanFilter',
    'is after or the same as': 'greaterThanOrEqualFilter',
    'is in the range of': 'rangeFilter'
  }
}