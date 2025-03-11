@Library('podTemplateLib')

import net.santiment.utils.podTemplates

slaveTemplates = new podTemplates()

slaveTemplates.dockerTemplate { label ->
  node(label) {
    container('docker') {
      def scmVars = checkout scm
      def imageName = "san-chain-exporter"

      stage('Run tests') {
        sh "./bin/test.sh"
      }

      def tag = sh(returnStdout: true, script: "set -o pipefail; git tag --contains | head -1").trim()
      def isTagDefined      = tag != null && tag.length() > 1
      def isProductionBuild = false
      if(isTagDefined) { // expect all tags were fetched by scm
        def latestTag     = sh(returnStdout: true, script: "git describe --tags --abbrev=4").trim()
        isProductionBuild = isTagDefined && tag == latestTag
      }
    def branch            = env.BRANCH_NAME
    def branchNameSanitized = "${env.BRANCH_NAME}".split('/').last()

      stage('Build image') {
        withCredentials([string(credentialsId: 'aws_account_id', variable: 'aws_account_id')]) {
          def awsRegistry = "${env.aws_account_id}.dkr.ecr.eu-central-1.amazonaws.com"
          docker.withRegistry("https://${awsRegistry}", "ecr:eu-central-1:ecr-credentials") {
            sh "docker build \
              -t ${awsRegistry}/${imageName}:${branchNameSanitized} \
              -t ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT} \
              -f docker/Dockerfile ."
            sh "docker push ${awsRegistry}/${imageName}:${branchNameSanitized}"
            sh "docker push ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT}"

            if(branch == 'master' || branch == 'main') {
              sh """
                  docker tag ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT} ${awsRegistry}/${imageName}:stage;
                  docker push ${awsRegistry}/${imageName}:stage
              """
            }
            if(isProductionBuild) {
                sh """
                    docker tag ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT} ${awsRegistry}/${imageName}:production;
                    docker push ${awsRegistry}/${imageName}:production
                """
            }
            if (isTagDefined) {
                sh """
                    docker tag ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT} ${awsRegistry}/${imageName}:${tag};
                    docker push ${awsRegistry}/${imageName}:${tag}
                """
            }
          }
        }
      }
    }
  }
}
