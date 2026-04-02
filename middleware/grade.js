/**
 * Returns { grade, remark } based on total score (0–100).
 */
function getGrade(total) {
  if (total >= 70) return { grade: 'A', remark: 'Excellent'     };
  if (total >= 60) return { grade: 'B', remark: 'Very Good'     };
  if (total >= 50) return { grade: 'C', remark: 'Good'          };
  if (total >= 45) return { grade: 'D', remark: 'Pass'          };
  if (total >= 40) return { grade: 'E', remark: 'Below Average' };
  return               { grade: 'F', remark: 'Fail'          };
}

/**
 * Returns the subject category filter for a given class string.
 */
function getCategoryForClass(cls) {
  if (!cls) return 'all';
  const upper = cls.toUpperCase();
  if (upper.startsWith('PRI')) return 'primary';
  if (upper.startsWith('JSS')) return 'junior';
  if (upper.startsWith('SS'))  return 'senior';
  return 'all';
}

module.exports = { getGrade, getCategoryForClass };
