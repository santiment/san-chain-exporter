const zk = require('node-zookeeper-client');

class ZookeeperClientAsync {
  constructor(zookeeperUrl, options) {
    this._client = zk.createClient(zookeeperUrl, options)
  }

  /**
   * Initiate the connection to the provided server list (ensemble). The client will
   * pick an arbitrary server from the list and attempt to connect to it. If the
   * establishment of the connection fails, another server will be tried (picked
   * randomly) until a connection is established or close method is invoked.
   * @returns {Promise} resolves on connect. Rejects with message on failure.
   */
  connectAsync() {
    return new Promise((resolve, reject) => {
      this._client.once('connected', () => resolve());
      this._client.once('connectedReadOnly', () => resolve());
      this._client.once('authenticationFailed', () => reject('Authentication failed.'));
      this._client.once('disconnected', () => reject('Client disconnected before it could open a successful connection.'));
      this._client.connect();
    });
  }

  /**
   * Close this client. Once the client is closed, its session becomes invalid. All the
   * ephemeral nodes in the ZooKeeper server associated with the session will be
   * removed. The watchers left on those nodes (and on their parents) will be triggered.
   * Resolves true when the client disconnects, resolves false if the client is already
   * disconnected.
   * @returns {Promise} resolves when disconnected. Does not reject.
   */
  closeAsync() {
    return new Promise((resolve, reject) => {
      if (this._client.getState() === zk.State.DISCONNECTED) {
        resolve(false);
      } else {
        this._client.once('disconnected', () => resolve(true));
        this._client.close();
      }
    });
  }

  /**
   * For the given node path, retrieve the children list and the stat. The children will
   * be an unordered list of strings. Resolves the stat object if the node exists,
   * resolves null if it does not exist, rejects if anything goes wrong.
   * @param {string} path the Path of the node.
   * @returns {Promise}
   */
  existsAsync(path) {
    return new Promise((resolve, reject) => {
      this._client.exists(path, null, (e, stat) => {
        if (e) {
          reject(e);
        } else {
          resolve(stat);
        }
      });
    });
  }

  /**
   * Retrieve the data and the stat of the node of the given path. Resolves an object
   * containing data as a Buffer object and stat as the stat object. Resolves null
   * if the node does not exist. Rejects if anything goes wrong.
   * @param {string} path the Path of the node.
   * @returns {Promise}
   */
  getDataAsync(path) {
    return new Promise((resolve, reject) => {
      this._client.getData(path, null, (e, data, stat) => {
        if (e) {
          if (e.code === zk.Exception.NO_NODE) resolve(null);
          else reject(e);
        } else {
          resolve({ data, stat });
        }
      });
    });
  }

  /**
   * Set the data for the node of the given path if such a node exists and the optional
   * given version matches the version of the node (if the given version is -1, it
   * matches any node's versions). Will resolve the stat of the node if successful. Will
   * reject if unsuccessful or if the node does not exist.
   * @param {string} path the Path of the node.
   * @param {Buffer} data the data to set on the node.
   * @param {Number} version the version to set. -1 (default) to match any version.
   * @returns {Promise}
   */
  setDataAsync(path, data, version = -1) {
    return new Promise((resolve, reject) => {
      this._client.setData(path, data, version, (e, stat) => {
        if (e) {
          reject(e);
        } else {
          resolve(stat);
        }
      });
    });
  }

  /**
   * Create given path in a way similar to mkdir -p. Will resolve the path if the node
   * is created and will reject if anything goes wrong.
   * @param {string} path the Path of the node.
   * @param {Buffer} data The data buffer, optional, defaults to null.
   * @param {ACL[]} acls  array of ACL objects, optional, defaults to ACL.OPEN_ACL_UNSAFE
   * @param {CreateMode} mode The creation mode, optional, defaults to CreateMode.PERSISTENT
   * @return {Promise}
   */
  mkdirpAsync(path, data = null, acls = null, mode = null) {
    return new Promise((resolve, reject) => {
      this._client.mkdirp(path, data, acls, mode, (e, path) => {
        if (e) {
          reject(e);
        } else {
          resolve(path);
        }
      });
    });
  }
}

module.exports = ZookeeperClientAsync;