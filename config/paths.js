const path = require('path');

module.exports = {
  BASE_WORKING_DIR: path.resolve(process.env.TOFU_WORKING_DIR || './workdirs'),
  OPENTOFU_CODE_DIR: path.resolve(
    process.env.OPENTOFU_CODE_DIR || './opentofu/services'
  ),
  NETWORK_CODE_DIR: path.resolve(
    process.env.NETWORK_CODE_DIR || './opentofu/networks'
  ),
};
