'use strict';

const path = require('path');

module.exports = {
	getSpecSeedsInfo,
	seededPropertyTestFactory,
};

function getSpecSeedsInfo(spec, absoluteFileName) {

	const fullName = spec.result.fullName;
	const parentName = (spec.result.fullName).replace(spec.result.description, '').trim();
	const snapShotFileName = path.resolve(
		path.dirname(absoluteFileName),
		'__snapshots__',
		`${path.basename(absoluteFileName)}.snap`);
	const snapshotSeedsName = `${parentName} seed`;

	//NOTE jest always appends a number,
	// even when snapshot name is explicitly specified
	// snapshotSeeds = JSON.parse(
	// 	require(snapShotFileName)[`${snapshotSeedsName} 1`]);
	let snapshotExports;
	try {
		snapshotExports = require(snapShotFileName);
	} catch (ex) {
		snapshotExports = {};
	}
	const snapshotSeeds = Object.keys(snapshotExports)
		.filter((key) => key.indexOf(snapshotSeedsName) === 0)
		.map((name) => {
			const matches = name.match(/.+\s(\d+)\s(\d+)/);
			if (!matches || matches.length !== 3) {
				return;
			}
			const seed = parseInt(matches[1], 10);
			if (isNaN(seed)) {
				return;
			}
			return seed;
		})
		.filter((seed) => !!seed);

	return {
		spec,
		fullName,
		parentName,
		snapShotFileName,
		snapshotSeedsName,
		snapshotSeeds,
		snapshotExports,
	};

}

function seededPropertyTestFactory(checkPropertyFn, absoluteFileName) {

	const descSpec = describe('[generated examples]', () => {

		let newSeed;
		let newSeedSnapshotName;
		let specSeedsInfo;

		const spec = it('new seed', () => {
			// Run with a *new* seed
			// specSeedsInfo = getSpecSeedsInfo(spec, absoluteFileName);
			const result = checkPropertyFn({
			});
			if (!result.result) {
				// This property based test has failed, add a snapshot as a new example based test
				newSeed = result.seed;
				newSeedSnapshotName = `${specSeedsInfo.snapshotSeedsName} ${result.seed}`;
				expect(result).toMatchSnapshot(newSeedSnapshotName);
			}
		});

		// Re-execute examples generated from *prior* seeds
		specSeedsInfo = getSpecSeedsInfo(spec, absoluteFileName);
		specSeedsInfo.snapshotSeeds.forEach((seed) => {
			const seedSpec = it(`seed ${seed}`, () => {
				// Run with a seed that has previously failed
				const result = checkPropertyFn({
					seed,
				});

				const snapshotText = specSeedsInfo.snapshotExports[`${seedSpec.result.fullName} 1`] || '';
				if (result.result) {
					//TODO if we don't run the snapshot, jest will earmark it as "obsolete"
					// Which is fine in most circumstances, but in this case we do want to keep it around
					// and don't want an "--updateSnapshots" to clear all the example based tests
					// that have been generated from the prior property based tests.
					// So figure out a way to prevent this from happening.
					// expect(result).toMatchSnapshot();
				} else {
					//NOTE Hack alert: Using a regex to extract input array as string from the serialized snapshot
					// this is, therefore, likely to be quite flakey/ not robust
					//TODO Write a lexer/ parser that can de-serialise https://github.com/thejameskyle/pretty-format
					const matches = snapshotText.match( /\n  \"fail\"\s*\:\s*Array\s*\[([\s\S]*)\n  \]/ );
					const input = `[${(matches && matches[1]) || ''}]`;
					expect({
						result: result.result,
						seed: result.seed,
						input,
					}).toEqual({
						result: true,
						seed,
						input,
					});
				}

			});
		});

		it('add new seed to list if any', () => {
			if (newSeed) {
				// When the property based test in 'new seed' has failed,
				// also append seed to list of failed seeds
				const updatedSnapshotSeeds = [...specSeedsInfo.snapshotSeeds, newSeed];
				expect(updatedSnapshotSeeds).toMatchSnapshot(`${specSeedsInfo.snapshotSeedsName} failed list`);
			}
		});

	});

}
