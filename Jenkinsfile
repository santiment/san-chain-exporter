@Library('podTemplateLib')

import net.santiment.utils.podTemplates

slaveTemplates = new podTemplates()

slaveTemplates.dockerTemplate { label ->
  node(label) {
    container('docker') {
      def scmVars = checkout scm
      def imageName = "san-chain-exporter"
      def ghcrRegistry = "ghcr.io"

      stage('Run tests') {
        sh "./bin/test.sh"
      }

      stage('Build image') {
        withCredentials([string(credentialsId: 'aws_account_id', variable: 'aws_account_id')]) {
          def awsRegistry = "${env.aws_account_id}.dkr.ecr.eu-central-1.amazonaws.com"
          def imageVersion = "${env.BRANCH_NAME}".replaceAll('[-+/%_ ]','').toLowerCase()

          sh "docker build \
            -t ${awsRegistry}/${imageName}:${imageVersion} \
            -t ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT} \
            -t ${ghcrRegistry}/santiment/${imageName}:${imageVersion} \
            -f docker/Dockerfile ."

          docker.withRegistry("https://${awsRegistry}", "ecr:eu-central-1:ecr-credentials") {
            sh "docker push ${awsRegistry}/${imageName}:${imageVersion}"
            sh "docker push ${awsRegistry}/${imageName}:${scmVars.GIT_COMMIT}"
          }

          docker.withRegistry("https://${ghcrRegistry}", "ghcr-credentials") {
            sh "docker push ${ghcrRegistry}/santiment/${imageName}:${imageVersion}"
          }
        }
      }
    }
  }
}
