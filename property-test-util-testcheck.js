'use strict';

const path = require('path');

const prettyFormat = require('pretty-format');

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
	let snapshotExports;
	try {
		snapshotExports = require(snapShotFileName);
	} catch (ex) {
		snapshotExports = {};
	}
	const snapshotSeedsFromExports = Object.keys(snapshotExports)
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
	const snapshotSeedsFromFailedListStr =
		snapshotExports[`${snapshotSeedsName} failed list 1`];
	let snapshotSeedsFromFailedList;
	try {
		snapshotSeedsFromFailedList = JSON.parse(snapshotSeedsFromFailedListStr);
	} catch (ex) {
		snapshotSeedsFromFailedList = [];
	}
	// Merge unique snapshot seeds from two different sources
	const snapshotSeeds =
		[...(new Set([
			...snapshotSeedsFromFailedList,
			...snapshotSeedsFromExports,
		]))];

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

// Use https://github.com/thejameskyle/pretty-format to format
// select parts of a result object, namely
// the input and the "shrunk" input
// This is needed because
// `JSON.stringify` does not encode values such as `NaN` or `Infinity`
// whereas `pretty-format` does do this
// On the other hand, `pretty-format` cannot be deserialised,
// whereas JSON can be deserialised via `JSON.parse`
// thus the most pertinent option is a combination of the two.
function transformResultForSerialisation(result) {
	const out = Object.assign({}, result, {
		fail: prettyFormat(result.fail, { min: true }),
		shrunk: Object.assign({}, result.shrunk, {
			smallest: prettyFormat(result.shrunk.smallest, { min: true }),
		}),
	});
	return out;
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
				expect(transformResultForSerialisation(result)).toMatchSnapshot(newSeedSnapshotName);
			}
		});

		// Re-execute examples generated from all *prior* seeds
		specSeedsInfo = getSpecSeedsInfo(spec, absoluteFileName);
		specSeedsInfo.snapshotSeeds.forEach((seed) => {
			const seedSpec = it(`seed ${seed}`, () => {
				// Run with a seed that has previously failed
				const result = checkPropertyFn({
					seed,
				});

				const snapshotText = specSeedsInfo.snapshotExports[`${seedSpec.result.fullName} 1`] || '';
				let snapshotObject;
				try {
					snapshotObject = JSON.parse(snapshotText);
				} catch (ex) {
					snapshotObject = result;
				}

				// If we don't run the snapshot, jest will earmark it as "obsolete"
				// Which is fine in most circumstances, but in this case we do want to keep it around
				// and don't want an "--updateSnapshots" to clear all the example based tests
				// that have been generated from the prior property based tests.
				// A redundant expectation where the snapshot is compared to itself
				// is used to guard against this obsoletion.
				// H/W if the `JSON.parse` above failed, then
				// This snapshot expectation could actually fail, intentionally, however,
				// when the `JSON.parse` above fails.
				expect(snapshotObject).toMatchSnapshot();

				if (!result.result) {
					// This example based test has failed, thus has not been fixed (or has regressed),
					// since the property based test generated this failing example
					const input = snapshotObject.fail;
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
			let snapshotSeeds;
			if (newSeed) {
				// When the property based test in 'new seed' has failed,
				// also append seed to list of failed seeds
				snapshotSeeds = [...specSeedsInfo.snapshotSeeds, newSeed];
			} else {
				snapshotSeeds = specSeedsInfo.snapshotSeeds;
			}
			expect(snapshotSeeds).toMatchSnapshot(`${specSeedsInfo.snapshotSeedsName} failed list`);
		});

	});

}
