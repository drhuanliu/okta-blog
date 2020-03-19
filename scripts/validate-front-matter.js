/**
 * This script will validate the legitimacy of each blog post's YAML
 * front matter. Specifically, it will look at the "communities" front matter
 * variable and ensure:
 *
 *   - It is an array
 *   - It contains only valid "communities"
 *
 * This is incredibly important because these community definitions are what we
 * use to track metrics on our site.
 */
const fs = require("fs");

const chalk = require("chalk");
const fm = require("front-matter");
const readdir = require("recursive-readdir");

const communities = require("../_source/_data/communities.json").communities;

function isValidCommunity(community) {
  return communities.includes(community);
}

readdir("_source/_posts", (err, files) => {
  if (err) throw err;

  for (let i = 0; i < files.length; i++) {
    let content, comms, err;

    try {
      content = fm(fs.readFileSync(files[i], "utf8"));
    } catch(err){
      console.error("ERROR: Could not parse YAML front matter for file:", files[i]);
      throw err;
    }

    comms = content.attributes.communities;
    if (comms) {
      if (Array.isArray(comms)) {
        if (!comms.every(isValidCommunity)) {
          err = true;
        }
      } else {
        if (!communities.includes(comms)) {
          err = true;
        }
      }

      if (err) {
        let validCommunities = chalk.green(communities.join(", "));
        let invalidCommunities = chalk.red(Array.isArray(comms) ? comms.join(", ") : comms);

        throw new Error(files[i] +
          " contains an invalid community in the YAML front matter. Valid communities are: " +
          validCommunities + ". You supplied: " + invalidCommunities + "."
        );
      }
    }
  }

  console.log(`Finished validating all YAML front matter for ${chalk.green('communities')}.`);
});
