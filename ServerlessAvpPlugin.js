const {
  VerifiedPermissionsClient,
  CreatePolicyStoreCommand,
  GetPolicyStoreCommand,
  DeletePolicyStoreCommand,
  CreatePolicyCommand,
  PutSchemaCommand,
} = require("@aws-sdk/client-verifiedpermissions");

const fs = require("fs");
const path = require("path");

class ServerlessAvpPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.avpConfig = this.serverless.service.custom.avp;
    this.region = this.serverless.service.provider.region;
    this.client = new VerifiedPermissionsClient({ region: this.region });

    this.commands = {
      createPolicyStore: {
        lifecycleEvents: ["create"],
      },
      deletePolicyStore: {
        lifecycleEvents: ["delete"],
      },
      putSchema: {
        lifecycleEvents: ["put"],
      },
      createStaticPolicy: {
        lifecycleEvents: ["create"],
      },
    };

    this.hooks = {
      "createPolicyStore:create": this.createPolicyStore.bind(this),
      "deletePolicyStore:delete": this.deletePolicyStore.bind(this),
      "createStaticPolicy:create": this.createStaticPolicy.bind(this),
      "putSchema:put": this.putSchema.bind(this),
    };
  }

  async createPolicyStore() {
    const policyStoreId = this.avpConfig.policyStoreId;

    if (policyStoreId) {
      const getCommand = new GetPolicyStoreCommand({ policyStoreId });
      try {
        const response = await this.client.send(getCommand);
        this.serverless.cli.log(
          `Policy store with ID: ${response.policyStoreId} already exists`
        );
        return;
      } catch (error) {
        this.serverless.cli.log(
          `Policy store with ID: ${policyStoreId} does not exist.`
        );
      }
    }
    const input = {
      validationSettings: {
        mode: this.avpConfig.validationMode,
      },
    };
    const createCommand = new CreatePolicyStoreCommand(input);
    try {
      const response = await this.client.send(createCommand);
      this.serverless.cli.log(
        `Policy store created with ID: ${response.policyStoreId}`
      );
    } catch (error) {
      this.serverless.cli.log(
        `Failed to create policy store: ${error.message}`
      );
    }
  }
  async deletePolicyStore() {
    const input = {
      policyStoreId: this.avpConfig.policyStoreId,
    };
    const command = new DeletePolicyStoreCommand(input);
    try {
      await this.client.send(command);
      this.serverless.cli.log(
        `Policy store deleted with ID: ${this.avpConfig.policyStoreId}`
      );
    } catch (error) {
      this.serverless.cli.log(
        `Failed to delete policy store: ${error.message}`
      );
    }
  }
  async createStaticPolicy() {
    const policyPath = this.avpConfig.policyPath;
    const policy = fs.readFileSync(policyPath, "utf8");

    const input = {
      policyStoreId: this.avpConfig.policyStoreId,
      definition: {
        static: {
          description: this.avpConfig.policyDescription,
          statement: policy,
        },
      },
    };
    const command = new CreatePolicyCommand(input);
    try {
      const response = await this.client.send(command);
      this.serverless.cli.log(
        `Static policy created with ID: ${response.policyId}`
      );
    } catch (error) {
      this.serverless.cli.log(
        `Failed to create static policy: ${error.message}`
      );
    }
  }
  async putSchema() {
    const schemaPath = this.avpConfig.schemaPath;
    const schemaJson = JSON.parse(
      fs.readFileSync(path.resolve(schemaPath), "utf-8")
    );
    const schema = JSON.stringify(schemaJson);
    const input = {
      policyStoreId: this.avpConfig.policyStoreId,
      definition: {
        cedarJson: schema,
      },
    };
    const command = new PutSchemaCommand(input);
    try {
      const response = await this.client.send(command);
      this.serverless.cli.log(
        `Schema put successfully for policy store ID: ${response.policyStoreId}`
      );
    } catch (error) {
      this.serverless.cli.log(`Failed to put schema: ${error.message}`);
    }
  }
}

module.exports = ServerlessAvpPlugin;
