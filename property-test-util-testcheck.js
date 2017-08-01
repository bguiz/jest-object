'use strict';

const path = require('path');

module.exports = {
	getSpecSeedsInfo,
	seededPropertyTestFactory,
};

function getSpecSeedsInfo(spec, absoluteFileName) {

	const fullName = spec.result.fullName;
	const snapShotFileName = path.resolve(
		path.dirname(absoluteFileName),
		'__snapshots__',
		`${path.basename(absoluteFileName)}.snap`);
	const snapshotSeedsName = `${fullName} seeds`;
	let snapshotSeeds;
	try {
		//NOTE jest always appends a number,
		// even when snaphsot name is explicitly specified
		snapshotSeeds = JSON.parse(
			require(snapShotFileName)[`${snapshotSeedsName} 1`]);
	} catch (ex) {
		snapshotSeeds = [];
	};

	return {
		spec,
		fullName,
		snapShotFileName,
		snapshotSeedsName,
		snapshotSeeds,
	};

}

function seededPropertyTestFactory(checkPropertyFn, absoluteFileName) {

	const spec =
		it('with new', () => {
			// Always run with a new seed
			const specSeedsInfo = getSpecSeedsInfo(spec, absoluteFileName);
			const result = checkPropertyFn({
			});
			if (!result.result) {
				// This has failed, and we will save the seed so that we an repeat them later
				const newSeed = {
					seed: result.seed,
				}
				specSeedsInfo.snapshotSeeds.push(newSeed);
				// Add a `[prior seeds]` snapshot
				expect(result).toMatchSnapshot(`${descSpec.result.fullName} ${result.seed}`)
			}
			// Append the failure seed
			// If there is a new failure, the snapshot will have a diff, and thus fail the test
			expect(specSeedsInfo.snapshotSeeds).toMatchSnapshot(specSeedsInfo.snapshotSeedsName);
		});

	const descSpec =
		describe('[prior seeds]', () => {
			const specSeedsInfo = getSpecSeedsInfo(spec, absoluteFileName);
			specSeedsInfo.snapshotSeeds.forEach((info) => {
				const seed = info.seed;
				it(`${seed}`, () => {
					// Always run with a seed that has previously failed
					const result = checkPropertyFn({
						seed,
					});
					expect(result).toMatchSnapshot();
				});
			});
		});

}
