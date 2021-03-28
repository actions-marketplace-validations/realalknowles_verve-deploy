# Verve Deploy #

GitHub action supporting lambda deployments against pre-existing infrastructure. Performs the following functions:

* Zip source code and dependencies at a specified location.
* Deploy the zipped source to given pre-existing lambda functions in given regions.
* Update the configuration of the pre-existing lambda functions to point to the correct entrypoint (handler).

See the [action metadata](./action.yml) for full documentation on the required inputs. 