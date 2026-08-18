const fs = require('fs');
const ind = require('india-states-districts');

const statesObj = ind.getAllStates() || [];
const statesList = statesObj.map(s => s.stateName || s).sort();

const districtsMap = {};
statesList.forEach(state => {
  const dists = ind.getDistrictsByState(state) || [];
  districtsMap[state] = dists.map(d => d.districtName || d).sort();
});

const data = {
  states: statesList,
  districts: districtsMap
};

fs.writeFileSync('./src/data/indiaStatesDistricts.json', JSON.stringify(data, null, 2));
console.log('Data dumped successfully!');
