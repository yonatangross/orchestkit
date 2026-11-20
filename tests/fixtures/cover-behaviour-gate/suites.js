fdescribe('focused suite', () => {
  it('adds', () => { expect(add(1, 2)).toBe(3); });
});

xdescribe('skipped suite', () => {
  xit('subtracts', () => { expect(sub(3, 2)).toBe(1); });
});
